import { AST_NODE_TYPES, AST_TOKEN_TYPES, ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";

import { defaultOptions } from "./consts";
import { isAccessor, reportProblem } from "./reporter";
import { schema } from "./schema";
import { OrderTypes } from "./types";

import type {
    AcceptableSlot,
    Groups,
    MemberInfo,
    Order,
    OrderItem,
    Slot,
    Slots,
    SortClassMembersConfig,
} from "./types";
import type { RuleContext, RuleFunction } from "@typescript-eslint/utils/ts-eslint";

const createRule = ESLintUtils.RuleCreator((name) => `https://example.com/rule/${name}`);

const sortClassMembersRule = (
    context: Readonly<
        RuleContext<"unorderedMember" | "unorderedClass" | "noClassExpression", [SortClassMembersConfig]>
    >,
): ESLintUtils.RuleListener => {
    const options = context.options[0] || defaultOptions;

    const stopAfterFirst = !!options.stopAfterFirstProblem;
    // const sortInterfaces = !!options.sortInterfaces;
    const accessorPairPositioning = options.accessorPairPositioning ?? "getThenSet";
    const order = options.order || [];
    const groups = { ...builtInGroups, ...options.groups };
    const orderedSlots = getExpectedOrder(order, groups);
    const groupAccessors = accessorPairPositioning !== "any";
    const locale = options.locale || "en-US";
    const groupPrivateWithAccessors = !!options.groupPrivateWithAccessors;

    const ClassDeclaration: RuleFunction<TSESTree.ClassDeclaration> = (node) => {
        let members = getClassMemberInfos(node, context.sourceCode, orderedSlots);

        // check for out-of-order and separated get/set pairs
        const accessorPairProblems = findAccessorPairProblems(members, accessorPairPositioning);
        for (const problem of accessorPairProblems) {
            reportProblem({
                context,
                problem,
                problemCount: accessorPairProblems.length,
                stopAfterFirst,
            });
            if (stopAfterFirst) break;
        }

        members = members.filter((m) => !(m.matchingAccessor && !m.isFirstAccessor));

        members = members.filter((member) => member.acceptableSlots?.length);

        if (groupPrivateWithAccessors) {
            members = groupPrivateFieldsWithAccessors(members);
        }

        // check member positions against rule order
        const problems = findProblems(members, locale);
        for (const problem of problems) {
            reportProblem({
                context,
                groupAccessors,
                problem,
                problemCount: problems.length,
                stopAfterFirst,
            });
            if (stopAfterFirst) break;
        }
    };

    // disallowed
    const ClassExpression: RuleFunction<TSESTree.ClassExpression> = (node) => {
        const tokens = context.sourceCode.getTokens(node);
        const classToken = tokens.find((token) => token.type === AST_TOKEN_TYPES.Keyword && token.value === "class");

        if (classToken) {
            context.report({
                loc: classToken.loc,
                messageId: "noClassExpression",
            });
        } else {
            context.report({
                messageId: "noClassExpression",
                node,
            });
        }
    };

    const rules: ESLintUtils.RuleListener = {
        ClassDeclaration,
        ClassExpression,
    };

    // if (sortInterfaces) {
    //     rules.TSInterfaceDeclaration = rules.ClassDeclaration;
    // }

    return rules;
};

const groupPrivateFieldsWithAccessors = (members: MemberInfo[]): MemberInfo[] => {
    // map member.id -> original index so we can preserve original ordering for matches
    const indexMap = new Map<string, number>();
    members.forEach((m, i) => {
        if (m.id !== undefined) {
            indexMap.set(m.id, i);
        }
    });
    console.log(members.map((x) => x.name));

    const grouped: MemberInfo[] = [];
    const used = new Set<string>();

    for (const member of members) {
        if (member.id !== undefined && used.has(member.id)) continue;
        if (member.id === undefined) continue;

        // we only apply this to `private _foo` or `#foo`
        if (member.type === "property" && member.private) {
            // compute the canonical base name to match against accessors
            // support both "#foo", "_foo" and "__foo" and plain "foo"
            const baseName = normalizePrivateName(member.name);

            // Find accessors with same normalized name and same staticness
            const matching = members
                .filter(
                    (m) =>
                        m.id !== undefined &&
                        !used.has(m.id) &&
                        isAccessor(m) &&
                        m.static === member.static &&
                        normalizePrivateName(m.name) === baseName,
                )
                // TODO: there shouldn't me multiple accessors
                .filter((m) => m.isFirstAccessor ?? true)
                // sort by original index
                .sort(
                    (a, b) =>
                        (a.id !== undefined ? indexMap.get(a.id) ?? 0 : 0) -
                        (b.id !== undefined ? indexMap.get(b.id) ?? 0 : 0),
                );

            // private field without setter or getter
            if (!matching[0]) continue;

            member.acceptableSlots = matching[0].acceptableSlots;

            if (!member.acceptableSlots?.[0]) {
                throw new Error();
            }
            member.acceptableSlots[0].score = member.acceptableSlots[0].score - 1;

            // push the property first, then the matching accessors (keeping their internal order)
            grouped.push(member, ...matching);
            used.add(member.id);
            matching.forEach((m) => m.id !== undefined && used.add(m.id));
            continue;
        }

        // otherwise, leave member in place
        grouped.push(member);
        used.add(member.id);
    }

    // reassign ids so that subsequent sorting checks use the new order
    grouped.forEach((m, i) => {
        m.id = String(i);
    });

    console.log(grouped.map((x) => x.name));

    return grouped;
};

/**
 * converts all of the below to `foo`
 * * `_foo`
 * * `#foo`
 * * `_#foo`
 * * `__foo`
 */
const normalizePrivateName = (name: string): string => name.replace(/^(#|_){1,2}/, "");

type ClassMember = Exclude<TSESTree.ClassElement, TSESTree.StaticBlock | TSESTree.TSIndexSignature>;

const getClassMemberInfos = (
    classDeclaration: TSESTree.ClassDeclaration,
    sourceCode: Readonly<TSESLint.SourceCode>,
    orderedSlots: Slot[],
): MemberInfo[] => {
    const classMemberNodes = classDeclaration.body.body;

    const nonstatic = classMemberNodes.filter((x) => x.type !== AST_NODE_TYPES.StaticBlock);
    const nonindexed = nonstatic.filter((x) => x.type !== AST_NODE_TYPES.TSIndexSignature);
    const filtered: ClassMember[] = nonindexed.filter((x) => x.key);

    const members = filtered
        .map((member, i) => ({ ...getMemberInfo(member, sourceCode), id: String(i) }))
        .map((memberInfo, _i, memberInfos) => {
            matchAccessorPairs(memberInfos);
            const acceptableSlots = getAcceptableSlots(memberInfo, orderedSlots);
            return { ...memberInfo, acceptableSlots };
        });

    return members;
};

const getMemberInfo = (node: ClassMember, sourceCode: Readonly<TSESLint.SourceCode>): MemberInfo => {
    const isPrivate = node.key.type === AST_NODE_TYPES.PrivateIdentifier || node.accessibility === "private";
    let name: string;
    let type: "property" | "method";
    let propertyType: string | undefined;
    let async = false;
    let decorators = [];
    const accessibility = node.accessibility ?? "public";
    const abstract =
        node.type === AST_NODE_TYPES.TSAbstractAccessorProperty ||
        node.type === AST_NODE_TYPES.TSAbstractPropertyDefinition ||
        node.type === AST_NODE_TYPES.TSAbstractMethodDefinition;

    decorators =
        (!!node.decorators &&
            node.decorators.map(({ expression }) => {
                if (expression.type === AST_NODE_TYPES.CallExpression && "name" in expression.callee) {
                    return expression.callee.name;
                }

                // expression.type === AST_NODE_TYPES.Identifier
                if ("name" in expression) {
                    return expression.name;
                }

                return "";
            })) ||
        [];

    if (node.type === AST_NODE_TYPES.PropertyDefinition || node.type === AST_NODE_TYPES.TSAbstractPropertyDefinition) {
        type = "property";

        if (isPrivate) {
            if ("name" in node.key) {
                name = node.key.name;
            } else if ("id" in node.key && node.key.id !== null) {
                name = node.key.id.name;
            } else {
                throw new Error("private property has no id or name");
            }
        } else {
            const [first, second] = sourceCode.getFirstTokens(node.key, 2);
            if (!first) {
                throw new Error("private property has no first token");
            }

            name = second?.type === AST_TOKEN_TYPES.Identifier ? second.value : first.value;
        }

        if (node.typeAnnotation) {
            propertyType = node.typeAnnotation.typeAnnotation.type;
        } else if (node.value) {
            propertyType = node.value.type;
        } else {
            throw new Error("node has no value");
        }
    } else {
        type = "method";

        if (node.computed) {
            const keyBeforeToken = sourceCode.getTokenBefore(node.key);
            const keyAfterToken = sourceCode.getTokenAfter(node.key);

            if (!keyBeforeToken || !keyAfterToken) {
                throw new Error("does there need to be a before and after token?");
            }

            name = sourceCode.getText().slice(keyBeforeToken.range[0], keyAfterToken.range[1]);
        } else {
            if (isPrivate) {
                if ("name" in node.key) {
                    name = node.key.name;
                } else if ("id" in node.key && node.key.id !== null) {
                    throw new Error("this one makes no sense");
                    // name = node.key.id.name;
                } else {
                    throw new Error("private method has no stuff");
                }
            } else if ("name" in node.key) {
                name = node.key.name;
            } else {
                throw new Error("this one is confusing tooo");
            }
        }
        async = (node.value && "async" in node.value && node.value.async) ?? false;
    }

    const readonly = "readonly" in node && node.readonly;
    let kind: "constructor" | "get" | "method" | "set" | "property";

    // example where kind doesn't exist:
    // abstract class Base extends Phaser.Scene {
    //     protected abstract debugging: boolean;
    // }

    if ("kind" in node) {
        kind = node.kind;
    } else if (type === "property") {
        kind = "property";
    } else {
        throw new Error("something went wrong");
    }

    return {
        abstract,
        accessibility,
        async,
        decorators,
        kind,
        name,
        node,
        override: node.override,
        private: isPrivate,
        propertyType,
        readonly: readonly,
        static: node.static,
        type,
    };
};

const findAccessorPairProblems = (
    members: MemberInfo[],
    positioning: "getThenSet" | "setThenGet" | "together" | "any",
): { source: MemberInfo; target: MemberInfo; expected: string }[] => {
    const problems: { source: MemberInfo; target: MemberInfo; expected: string }[] = [];
    if (positioning === "any") return problems;

    forEachPair(members, (first, second, firstIndex, secondIndex) => {
        if (first.matchingAccessor === second.id) {
            const outOfOrder =
                (positioning === "getThenSet" && first.kind !== "get") ||
                (positioning === "setThenGet" && first.kind !== "set");
            const outOfPosition = secondIndex - firstIndex !== 1;

            if (outOfOrder || outOfPosition) {
                const expected = outOfOrder ? "before" : "after";
                problems.push({ expected, source: second, target: first });
            }
        }
    });

    return problems;
};

const findProblems = (
    members: MemberInfo[],
    locale: string,
): { source: MemberInfo; target: MemberInfo; expected: string }[] => {
    const problems: { source: MemberInfo; target: MemberInfo; expected: string }[] = [];
    const collator = new Intl.Collator(locale);

    forEachPair(members, (first, second) => {
        if (!areMembersInCorrectOrder(first, second, collator)) {
            problems.push({ expected: "before", source: second, target: first });
        }
    });

    return problems;
};

const forEachPair = <T>(
    list: T[],
    callback: (first: T, second: T, firstIndex: number, secondIndex: number) => void,
): void => {
    list.forEach((first, firstIndex) => {
        list.slice(firstIndex + 1).forEach((second, secondIndex) => {
            callback(first, second, firstIndex, firstIndex + secondIndex + 1);
        });
    });
};

const areMembersInCorrectOrder = (first: MemberInfo, second: MemberInfo, collator: Intl.Collator): boolean => {
    if (first.acceptableSlots === undefined) return false;

    return first.acceptableSlots.some((a) => {
        if (second.acceptableSlots === undefined) return true;

        return second.acceptableSlots.some((b) =>
            a.index === b.index && areSlotsAlphabeticallySorted(a, b)
                ? collator.compare(first.name, second.name) <= 0
                : a.index <= b.index,
        );
    });
};

const areSlotsAlphabeticallySorted = (a: AcceptableSlot, b: AcceptableSlot): boolean =>
    a.sort === "alphabetical" && b.sort === "alphabetical";

const getAcceptableSlots = (memberInfo: MemberInfo, orderedSlots: Slot[]): AcceptableSlot[] =>
    orderedSlots
        .map((slot, index) => ({ index, score: scoreMember(memberInfo, slot), sort: slot.sort }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .filter(({ score }, _i, array) => score === array[0]?.score)
        .sort((a, b) => b.index - a.index);

const scoreMember = (memberInfo: MemberInfo, slot: Slot): number => {
    if (Object.keys(slot).length === 0) return 1;

    let totalScore = 0;
    let failed = false;
    for (const { property, test, value } of comparers) {
        if (slot[property] !== undefined) {
            if (test(memberInfo, slot)) {
                totalScore += value;
            } else {
                failed = true;
                break;
            }
        }
    }

    return failed ? -1 : totalScore;
};

const getExpectedOrder = (order: OrderItem[], groups: Groups): Slot[] =>
    flatten<Slot>(order.map((s) => flat(expandSlot(s, groups))));

// this feels bad
const flat = (slots: Slots[]): Slot[] =>
    flatten<Slot>(
        slots.map((slot) => {
            if (Array.isArray(slot)) {
                return flat(slot);
            }
            return slot;
        }),
    );

const expandSlot = (input: Order, groups: Groups): Slots[] => {
    if (Array.isArray(input)) return input.map((x: OrderItem) => expandSlot(x, groups));

    let slot: Slot;
    if (typeof input === "string") {
        slot = input.startsWith("[") ? { group: input.substring(1, input.length - 1) } : { name: input };
    } else {
        slot = { ...input };
    }

    if (slot.group !== undefined) {
        if (Object.prototype.hasOwnProperty.call(groups, slot.group)) {
            const group = groups[slot.group];
            if (group === undefined) return [];

            return expandSlot(group, groups);
        }
        return [];
    }

    const testName = slot.name !== undefined && getStringComparer(slot.name);
    if (testName !== false) {
        slot.testName = testName;
    }

    return [slot];
};

const matchAccessorPairs = (members: MemberInfo[]) => {
    forEachPair(members, (first, second) => {
        const isMatch = first.name === second.name && first.static === second.static;
        if (isAccessor(first) && isAccessor(second) && isMatch) {
            first.isFirstAccessor = true;
            first.matchingAccessor = second.id;
            second.matchingAccessor = first.id;
        }
    });
};

const getStringComparer = (str: string): ((s: string) => boolean) => {
    // is regex pattern
    if (str.startsWith("/")) {
        let strPattern = str.substring(1, str.length - 1);
        if (!strPattern.startsWith("^")) strPattern = `^${strPattern}`;
        if (!strPattern.endsWith("$")) strPattern += "$";
        const re = new RegExp(strPattern);
        return (s) => re.test(s);
    }
    return (s) => s === str;
};

const flatten = <T>(collection: (T | T[])[]): T[] => {
    const result = [];
    for (const item of collection) {
        if (Array.isArray(item)) result.push(...flatten(item));
        else result.push(item);
    }
    return result;
};

const builtInGroups: Groups = {
    "accessor-pairs": { accessorPair: true },
    "arrow-function-properties": { propertyType: "ArrowFunctionExpression" },
    "async-methods": { async: true, type: "method" },
    "constructor": { name: "constructor", type: OrderTypes.method },
    "conventional-private-methods": { name: "/_.+/", type: "method" },
    "conventional-private-properties": { name: "/_.+/", type: "property" },
    "everything-else": {},
    "getters": { kind: "get" },
    "methods": { type: "method" },
    "properties": { type: "property" },
    "setters": { kind: "set" },
    "static-methods": { static: true, type: "method" },
    "static-properties": { static: true, type: "property" },
};

const comparers: {
    property:
        | "name"
        | "type"
        | "static"
        | "async"
        | "private"
        | "accessibility"
        | "abstract"
        | "override"
        | "readonly"
        | "kind"
        | "groupByDecorator"
        | "accessorPair";
    value: number;
    test: (m: MemberInfo, s: Slot) => boolean;
}[] = [
    // Core grouping signals
    { property: "type", test: (m, s) => s.type === m.type, value: 10 }, // 5
    { property: "static", test: (m, s) => s.static === m.static, value: 10 }, // 4
    { property: "accessibility", test: (m, s) => s.accessibility === m.accessibility, value: 10 }, // 4
    { property: "private", test: (m, s) => s.private === m.private, value: 10 }, // 4
    {
        property: "kind",
        test: (m, s) => {
            if (s.kind === "accessor") return isAccessor(m);
            else if (s.kind === "nonAccessor") return !isAccessor(m);
            return s.kind === m.kind;
        },
        value: 10, // 3
    },

    // Additional classification signals
    { property: "abstract", test: (m, s) => s.abstract === m.abstract, value: 10 }, // 2
    { property: "override", test: (m, s) => s.override === m.override, value: 10 }, // 2
    { property: "readonly", test: (m, s) => s.readonly === m.readonly, value: 10 }, // 2
    { property: "async", test: (m, s) => s.async === m.async, value: 10 }, // 1

    // Weak matchers (decorators, name, etc.)
    {
        property: "groupByDecorator",
        test: (m, s) => {
            if (s.groupByDecorator === undefined) return false;
            if (typeof s.groupByDecorator === "boolean") {
                return s.groupByDecorator === m.decorators.length > 0;
            }
            const comparer = getStringComparer(s.groupByDecorator);
            return m.decorators.some((decorator) => comparer(decorator));
        },
        value: 10, // 1
    },
    {
        property: "accessorPair",
        test: (m: MemberInfo, _s: Slot) => isAccessor(m) && m.matchingAccessor !== undefined,
        value: 10, // 20
    },
    // Leaves enough space for grouping by name
    { property: "name", test: (m, s) => s.testName?.(m.name) === true, value: 100 },
];

export const rule = createRule({
    create: sortClassMembersRule,
    defaultOptions: [{}],
    meta: {
        docs: {
            description:
                "Enforce consistent members order, optionally grouping private fields with their respective getters/setters.",
        },
        fixable: "code",
        messages: {
            // unorderedClass:
            //     "Expected {{ source }} to come {{ expected }} {{ target }}. ({{ more }} similar {{ problem }} in this class)",
            noClassExpression: "Class Expressions are not supported",
            unorderedClass:
                "Expected {{ source }} to come immediately {{ expected }} {{ target }}. ({{ more }} similar {{ problem }} in this class)",
            unorderedMember: "Expected {{ source }} to come immediately {{ expected }} {{ target }}.",
        },
        schema,
        type: "suggestion",
    },

    name: "sort-member",
});
