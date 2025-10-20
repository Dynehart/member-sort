import { AST_NODE_TYPES, ESLintUtils, TSESTree } from "@typescript-eslint/utils";

import { schema } from "./schema";
import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import type { RuleFunction } from "@typescript-eslint/utils/ts-eslint";
import { SourceCode } from "@typescript-eslint/utils/ts-eslint";

import { isAccessor, reportProblem } from "./reporter";
import type {
    Order,
    SortClassMembersConfig,
    OrderItem,
    Groups,
    MemberInfo,
    Slot,
    AcceptableSlot,
    Slots,
} from "./types";

import { OrderTypes } from "./types";

const createRule = ESLintUtils.RuleCreator((name) => `https://example.com/rule/${name}`);

const sortClassMembersRule = (
    context: Readonly<
        RuleContext<"unorderedMember" | "unorderedClass" | "noClassExpression", [SortClassMembersConfig]>
    >,
): ESLintUtils.RuleListener => {
    const options = context.options[0] || {
        // accessorPairPositioning: "together",
        accessorPairPositioning: "getThenSet",
        groupPrivateWithAccessors: true,
        groups: {
            "accessors": [
                { name: "/on.+/", type: "method" },
                "[accessor-pairs]",
                "[conventional-private-methods]",
                "[getters]",
                "[setters]",
            ],
            "event-handlers": [{ name: "/on.+/", type: "method" }, "[conventional-private-methods]"],
        },
        order: [
            "[static-properties]",
            "[static-methods]",
            "[properties]",
            "[conventional-private-properties]",
            "constructor",
            // "[accessors]",
            // "[event-handlers]", // reference the custom group defined in the "groups" property
            "[methods]",
            // "[conventional-private-methods]",
            "[everything-else]",
        ],
        stopAfterFirstProblem: true,
    };
    // // TODO: handle defaults better
    // if (!options) {
    //     throw new Error("undefined defaults")
    // }

    const stopAfterFirst = !!options.stopAfterFirstProblem;
    // const sortInterfaces = !!options.sortInterfaces;
    const accessorPairPositioning = options.accessorPairPositioning || "getThenSet";
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
            const message = "Expected {{ source }} to come immediately {{ expected }} {{ target }}.";
            reportProblem({
                problem,
                context,
                message,
                stopAfterFirst,
                problemCount: accessorPairProblems.length,
            });
            if (stopAfterFirst) break;
        }

        members = members.filter((m) => !(m.matchingAccessor && !m.isFirstAccessor));

        members = members.filter((member) => member.acceptableSlots?.length);

        console.log(groups)
        if (groupPrivateWithAccessors) {
            members = groupPrivateFieldsWithAccessors(members);
        }

        // check member positions against rule order
        const problems = findProblems(members, locale);
        for (const problem of problems) {
            const message = "Expected {{ source }} to come {{ expected }} {{ target }}.";
            reportProblem({
                problem,
                message,
                context,
                stopAfterFirst,
                problemCount: problems.length,
                groupAccessors,
            });
            if (stopAfterFirst) break;
        }
    };

    // disallowed
    const ClassExpression: RuleFunction<TSESTree.ClassExpression> = (node) => {
        const tokens = context.sourceCode.getTokens(node);
        const classToken = tokens.find((token) => token.type === "Keyword" && token.value === "class");

        if (classToken) {
            context.report({
                loc: classToken.loc,
                messageId: "noClassExpression",
            });
        } else {
            context.report({
                node,
                messageId: "noClassExpression",
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

export const rule = createRule({
    name: "sort-member",
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Enforce consistent members order, optionally grouping private fields with their respective getters/setters.",
        },
        messages: {
            unorderedMember: "Expected {{ source }} to come immediately {{ expected }} {{ target }}.",
            unorderedClass:
                "Expected {{ source }} to come immediately {{ expected }} {{ target }}. ({{ more }} similar {{ problem }} in this class)",
            noClassExpression: "Class Expressions are not supported",
        },
        fixable: "code",
        schema,
    },
    defaultOptions: [{}],

    create: sortClassMembersRule,
});

const groupPrivateFieldsWithAccessors = (members: Array<MemberInfo>): Array<MemberInfo> => {
    console.log("groupPrivateFieldsWithAccessors");
    const grouped = [];
    const used = new Set();

    for (const member of members) {
        if (used.has(member.id)) continue;

        // Only consider private properties
        if (member.type === "property" && member.private) {
            console.log("private", member);
            const name = normalizePrivateName(member.name);
            const matching = members.filter(
                (m) => !used.has(m.id) && isAccessor(m) && normalizePrivateName(m.name) === name,
            );
            console.log(matching);
            console.log(used);

            if (matching.length > 0) {
                grouped.push(member, ...matching);
                used.add(member.id);
                matching.forEach((m) => used.add(m.id));
                continue;
            }
        }

        // Also handle conventional private (_foo) fields
        if (member.type === "property" && member.name.startsWith("_")) {
            console.log("conventional", member);
            const name = member.name.replace(/^_+/, "");
            const matching = members.filter(
                (m) => !used.has(m.id) && isAccessor(m) && normalizePrivateName(m.name) === name,
            );

            if (matching.length > 0) {
                grouped.push(member, ...matching);
                used.add(member.id);
                matching.forEach((m) => used.add(m.id));
                continue;
            }
        }

        grouped.push(member);
        used.add(member.id);
    }

    return grouped;
};

function normalizePrivateName(name: string): string {
    return name.replace(/^(#|_){1,2}/, "");
}

// -------------------
// Existing Functions (unchanged from original rule)
// -------------------

type ClassMember = Exclude<TSESTree.ClassElement, TSESTree.StaticBlock | TSESTree.TSIndexSignature>;

function getClassMemberInfos(
    classDeclaration: TSESTree.ClassDeclaration, // | TSESTree.ClassExpression
    sourceCode: Readonly<SourceCode>,
    orderedSlots: Slot[],
): MemberInfo[] {
    const classMemberNodes = classDeclaration.body.body;

    console.log(classMemberNodes);

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
}

function getMemberInfo(node: ClassMember, sourceCode: Readonly<SourceCode>): MemberInfo {
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

            name = second && second.type === "Identifier" ? second.value : first.value;
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
                    name = node.key.id.name;
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

    const readonly = ("readonly" in node && node.readonly) ?? false;
    let kind: "constructor" | "get" | "method" | "set";

    // example where kind doesn't exist:
    // abstract class Base extends Phaser.Scene {
    //     protected abstract debugging: boolean;
    // }

    if ("kind" in node) {
        kind = node.kind;
    } else {
        // console.log(node)
    }

    return {
        name,
        type,
        decorators,
        static: node.static,
        abstract,
        override: node.override,
        readonly: readonly,
        async,
        private: isPrivate,
        accessibility,
        kind,
        propertyType,
        node,
    };
}

function findAccessorPairProblems(
    members: MemberInfo[],
    positioning: "getThenSet" | "setThenGet" | "together" | "any",
): Array<{ source: MemberInfo; target: MemberInfo; expected: string }> {
    const problems: Array<{ source: MemberInfo; target: MemberInfo; expected: string }> = [];
    if (positioning === "any") return problems;

    forEachPair(members, (first, second, firstIndex, secondIndex) => {
        if (first.matchingAccessor === second.id) {
            const outOfOrder =
                (positioning === "getThenSet" && first.kind !== "get") ||
                (positioning === "setThenGet" && first.kind !== "set");
            const outOfPosition = secondIndex - firstIndex !== 1;

            if (outOfOrder || outOfPosition) {
                const expected = outOfOrder ? "before" : "after";
                problems.push({ source: second, target: first, expected });
            }
        }
    });

    return problems;
}

function findProblems(
    members: MemberInfo[],
    locale: string,
): Array<{ source: MemberInfo; target: MemberInfo; expected: string }> {
    const problems: Array<{ source: MemberInfo; target: MemberInfo; expected: string }> = [];
    const collator = new Intl.Collator(locale);

    forEachPair(members, (first, second) => {
        if (!areMembersInCorrectOrder(first, second, collator)) {
            problems.push({ source: second, target: first, expected: "before" });
        }
    });

    return problems;
}

function forEachPair<T>(
    list: T[],
    callback: (first: T, second: T, firstIndex: number, secondIndex: number) => void,
): void {
    list.forEach((first, firstIndex) => {
        list.slice(firstIndex + 1).forEach((second, secondIndex) => {
            callback(first, second, firstIndex, firstIndex + secondIndex + 1);
        });
    });
}

function areMembersInCorrectOrder(first: MemberInfo, second: MemberInfo, collator: Intl.Collator): boolean {
    return (
        first.acceptableSlots?.some((a) =>
            second.acceptableSlots?.some((b) =>
                a.index === b.index && areSlotsAlphabeticallySorted(a, b)
                    ? collator.compare(first.name, second.name) <= 0
                    : a.index <= b.index,
            ),
        ) || false
    );
}

function areSlotsAlphabeticallySorted(a: AcceptableSlot, b: AcceptableSlot): boolean {
    return a.sort === "alphabetical" && b.sort === "alphabetical";
}

function getAcceptableSlots(memberInfo: MemberInfo, orderedSlots: Slot[]): AcceptableSlot[] {
    return orderedSlots
        .map((slot, index) => ({ index, score: scoreMember(memberInfo, slot), sort: slot.sort }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .filter(({ score }, _i, array) => score === array?.[0]?.score)
        .sort((a, b) => b.index - a.index);
}

function scoreMember(memberInfo: MemberInfo, slot: Slot): number {
    if (!Object.keys(slot).length) return 1;

    const scores = comparers.map(({ property, value, test }) => {
        if (slot[property] !== undefined) {
            return test(memberInfo, slot) ? value : -1;
        }
        return 0;
    });

    if (scores.indexOf(-1) !== -1) return -1;
    return scores.reduce((a, b) => a + b);
}

function getExpectedOrder(order: OrderItem[], groups: Groups): Slot[] {
    return flatten<Slot>(order.map((s) => flat(expandSlot(s, groups))));
}

// this feels bad
const flat = (slots: Slots[]): Slot[] => {
    return flatten<Slot>(
        slots.map((slot) => {
            if (Array.isArray(slot)) {
                return flat(slot);
            }
            return slot;
        }),
    );
};

function expandSlot(input: Order, groups: Groups): Slots[] {
    if (Array.isArray(input)) return input.map((x: OrderItem) => expandSlot(x, groups));

    let slot: Slot;
    if (typeof input === "string") {
        slot = input[0] === "[" ? { group: input.substr(1, input.length - 2) } : { name: input };
    } else {
        slot = { ...input };
    }

    if (slot.group) {
        if (Object.prototype.hasOwnProperty.call(groups, slot.group)) {
            if (slot.group === undefined) return [];

            const group = groups[slot.group];
            if (group === undefined) return [];

            return expandSlot(group, groups);
        }
        return [];
    }

    const testName = slot.name && getStringComparer(slot.name);
    if (testName) {
        slot.testName = testName;
    }

    return [slot];
}

function matchAccessorPairs(members: MemberInfo[]) {
    forEachPair(members, (first, second) => {
        const isMatch = first.name === second.name && first.static === second.static;
        if (isAccessor(first) && isAccessor(second) && isMatch) {
            first.isFirstAccessor = true;
            first.matchingAccessor = second.id;
            second.matchingAccessor = first.id;
        }
    });
}

function getStringComparer(str: string): (s: string) => boolean {
    if (str[0] === "/") {
        let strPattern = str.substr(1, str.length - 2);
        if (strPattern[0] !== "^") strPattern = `^${strPattern}`;
        if (strPattern[strPattern.length - 1] !== "$") strPattern += "$";
        const re = new RegExp(strPattern);
        return (s) => re.test(s);
    }
    return (s) => s === str;
}

function flatten<T>(collection: (T | T[])[]): T[] {
    const result = [];
    for (const item of collection) {
        if (Array.isArray(item)) result.push(...flatten(item));
        else result.push(item);
    }
    return result;
}

const builtInGroups: Groups = {
    "constructor": { type: OrderTypes.method, name: "constructor" },
    "properties": { type: "property" },
    "getters": { kind: "get" },
    "setters": { kind: "set" },
    "accessor-pairs": { accessorPair: true },
    "static-properties": { type: "property", static: true },
    "conventional-private-properties": { type: "property", name: "/_.+/" },
    "arrow-function-properties": { propertyType: "ArrowFunctionExpression" },
    "methods": { type: "method" },
    "static-methods": { type: "method", static: true },
    "async-methods": { type: "method", async: true },
    "conventional-private-methods": { type: "method", name: "/_.+/" },
    "everything-else": {},
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
    { property: "name", value: 100, test: (m, s) => s.testName !== undefined && s.testName(m.name) },
    { property: "type", value: 10, test: (m, s) => s.type === m.type },
    { property: "static", value: 10, test: (m, s) => s.static === m.static },
    { property: "async", value: 10, test: (m, s) => s.async === m.async },
    { property: "private", value: 10, test: (m, s) => s.private === m.private },
    { property: "accessibility", value: 10, test: (m, s) => s.accessibility == m.accessibility },
    { property: "abstract", value: 10, test: (m, s) => s.abstract == m.abstract },
    { property: "override", value: 10, test: (m, s) => s.override == m.override },
    { property: "readonly", value: 10, test: (m, s) => s.readonly == m.readonly },
    {
        property: "kind",
        value: 10,
        test: (m, s) => {
            if (s.kind === "accessor") return isAccessor(m);
            else if (s.kind === "nonAccessor") return !isAccessor(m);
            else return s.kind === m.kind;
        },
    },
    {
        property: "groupByDecorator",
        value: 10,
        test: (m, s) => {
            if (s.groupByDecorator === undefined) return false;

            if (typeof s.groupByDecorator === "boolean") {
                const hasDecorators = m.decorators.length > 0;
                return s.groupByDecorator === hasDecorators;
            }

            const comparer = getStringComparer(s.groupByDecorator);
            return m.decorators.some((decorator) => comparer(decorator));
        },
    },
    {
        property: "accessorPair",
        value: 20,
        test: (m: MemberInfo, _s: Slot) => isAccessor(m) && m.matchingAccessor !== undefined,
    },
];
