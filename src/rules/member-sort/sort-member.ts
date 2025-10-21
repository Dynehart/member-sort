import { AST_NODE_TYPES, AST_TOKEN_TYPES, ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";

import { defaultOptions } from "./consts";
import { isAccessor, reportProblem } from "./reporter";
import { schema } from "./schema";

import type {
    AcceptableSlot,
    Groups,
    Kind,
    MemberInfo,
    MessageIds,
    Order,
    OrderItem,
    Slot,
    Slots,
    SortClassMembersConfig,
} from "./types";
import type { RuleContext, RuleFunction } from "@typescript-eslint/utils/ts-eslint";

const createRule = ESLintUtils.RuleCreator((name) => `https://example.com/rule/${name}`);

const sortClassMembersRule = (
    context: Readonly<RuleContext<MessageIds, [SortClassMembersConfig]>>,
): ESLintUtils.RuleListener => {
    const options = context.options[0];

    const stopAfterFirst = options.stopAfterFirstProblem;
    // const sortInterfaces = options.sortInterfaces;
    const accessorPairPositioning = options.accessorPairPositioning;
    const order = options.order;
    const groups = options.groups;
    const groupPrivateWithAccessors = options.groupPrivateWithAccessors;

    const orderedSlots = getExpectedOrder(order, groups);

    const groupAccessors = accessorPairPositioning !== "any";
    const locale = options.locale || "en-US";

    const ClassDeclaration: RuleFunction<TSESTree.ClassDeclaration> = (node) => {
        console.log("START START START", node.body.parent.id?.name);
        let members = getClassMemberInfos(node, context.sourceCode, orderedSlots);

        // check for out-of-order and separated get/set pairs
        const accessorPairProblems = findAccessorPairProblems(members, accessorPairPositioning);
        for (const problem of accessorPairProblems) {
            reportProblem({
                context,
                messageId: "accessorPair",
                problem,
                problemCount: accessorPairProblems.length,
                stopAfterFirst,
            });
            if (stopAfterFirst) break;
        }

        members = members.filter((m) => !(m.matchingAccessor && !m.isFirstAccessor));

        // members.forEach((m) => {
        //     if (m.acceptableSlots?.length === 0) {
        //         console.log(m);
        //     }
        // });

        // members.forEach((member) => {
        //     console.log(member.name);
        //     member.acceptableSlots?.forEach((slot) => {
        //         console.log(member.name, slot, member.accessibility, member.type);
        //     });
        // });

        // members.forEach((m, i) => {
        //     console.log(m.name, m.id, i);
        // });

        if (groupPrivateWithAccessors) {
            // TODO: we need a better way to order within each group
            const collator = new Intl.Collator(locale);

            members.forEach((first, firstIndex) => {
                members.slice(firstIndex + 1).forEach((second) => {
                    if (first.acceptableSlots?.[0] === undefined || second.acceptableSlots?.[0] === undefined) {
                        throw new Error("shouldn't happen");
                    }

                    membersInCorrectOrderFirstPass(
                        first,
                        second,
                        collator,
                        options.alphabetical,
                        
                    );
                });
            });

            // console.log("groupPrivateWithAccessors");
            groupPrivateFieldsWithAccessors(members);
        }

        members.forEach((member) => {
            console.log(member.name);
            member.acceptableSlots?.forEach((slot) => {
                console.log(member.name, slot);
            });
        });

        members.forEach((m, i) => {
            console.log(m.name, m.id, i);
        });

        // check member positions against rule order
        const problems = findProblems(members, locale, options.alphabetical);
        for (const problem of problems) {
            reportProblem({
                context,
                groupAccessors,
                messageId: "unorderedMember",
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

const groupPrivateFieldsWithAccessors = (members: MemberInfo[]): void => {
    // map member.id -> original index so we can preserve original ordering for matches
    const indexMap = new Map<string, number>();
    members.forEach((m, i) => {
        if (m.id !== undefined) {
            indexMap.set(m.id, i);
        }
    });

    const used = new Set<string>();

    for (const member of members) {
        if (member.id !== undefined && used.has(member.name)) {
            continue;
            // throw new Error(`${member.name} with id:${member.id} is a duplicate`);
        }
        if (member.id === undefined) {
            throw new Error(`${member.name} has not had an id set`);
        }

        // we only apply this to `private _foo` or `#foo`
        if (member.type === "property" && member.private) {
            // compute the canonical base name to match against accessors
            // support both "#foo", "_foo" and "__foo" and plain "foo"
            const baseName = normalizePrivateName(member.name);

            // Find accessors with same name as the normalized name and the same staticness
            const matching = members
                .filter(
                    (m) =>
                        m.id !== undefined &&
                        !used.has(m.name) &&
                        isAccessor(m) &&
                        m.static === member.static &&
                        m.name === baseName,
                )
                // TODO: there shouldn't me multiple accessors
                .filter((m) => m.isFirstAccessor ?? true)
                // sort by original index
                .sort(
                    (a, b) =>
                        (b.id !== undefined ? indexMap.get(b.id) ?? 0 : 0) -
                        (a.id !== undefined ? indexMap.get(a.id) ?? 0 : 0),
                );

            // console.log(`matching ${member.name} to:\n`, matching);
            // does not have a matching setter or getter
            // if (matching.length === 0) continue;

            // private field without setter or getter that have been sorted
            if (!matching[0]) {
                used.add(member.name);
                continue;
            }

            if (!matching[0].acceptableSlots) {
                throw new Error();
            }

            const slot = matching[0].acceptableSlots[0];
            if (slot) {
                console.log("this shit");
                member.acceptableSlots = [{ ...slot, score: slot.score - 1 }];
            } else {
                console.log("shouldn't really happen");
            }

            // mark both getter and setters as used
            matching.forEach((m) => used.add(m.name));
        }

        used.add(member.name);
    }
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
            const acceptableSlots = [getAcceptableSlot(memberInfo, orderedSlots)];
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
    let kind: Kind;

    // example where kind doesn't exist:
    // abstract class Base extends Phaser.Scene {
    //     protected abstract debugging: boolean;
    // }

    if ("kind" in node) {
        kind = node.kind;
    } else if (type === "property") {
        kind = null;
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
    alphabetical: boolean,
): { source: MemberInfo; target: MemberInfo; expected: string }[] => {
    const problems: { source: MemberInfo; target: MemberInfo; expected: string }[] = [];
    const collator = new Intl.Collator(locale);

    forEachPair(members, (first, second) => {
        if (!areMembersInCorrectOrder(first, second, collator, alphabetical, true)) {
            problems.push({ expected: "before", source: second, target: first });
            // after will get ignored by fixes but is helpful to show
            problems.push({ expected: "after", source: first, target: second });
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

/** this one does index, then alphabetical then score to help pre-sort */
const membersInCorrectOrderFirstPass = (
    first: MemberInfo,
    second: MemberInfo,
    collator: Intl.Collator,
    alphabetical: boolean,
    test: boolean = true
): void => {
    if (first.acceptableSlots?.[0] === undefined) return

    first.acceptableSlots.forEach((a) => {
        if (second.acceptableSlots === undefined) return

        second.acceptableSlots.forEach((b) => {
            if (test === true) {
                console.log(`${first.name}: ${a.index}.${a.score} vs ${second.name}: ${b.index}.${b.score}`);
            }

            if (a.index !== b.index) {
                if (test === true) {
                    console.log("a.index !== b.index", a.index < b.index);
                }
                return
            }

            if (a.score !== b.score) {
                if (test === true) {
                    console.log("a.score !== b.score", a.score < b.score);
                }
                return
            }

            // alphabetical within group
            if (alphabetical || areSlotsAlphabeticallySorted(a, b)) {
                if (test === true) {
                    console.log(`collator.compare(${first.name}, ${second.name})`, collator.compare(first.name, second.name) <= 0);
                    // console.log(`areSlotsAlphabeticallySorted(a, b)`);
                }
                if (collator.compare(first.name, second.name) <= 0) {
                    b.score = a.score + 10
                        console.log(`setting ${second.name} to ${first.name}+1`);
                } else {
                    a.score = b.score + 10
                        console.log(`setting ${first.name} to ${second.name}+1`);
                }
            }
        });
    });
};

const areMembersInCorrectOrder = (
    first: MemberInfo,
    second: MemberInfo,
    collator: Intl.Collator,
    alphabetical: boolean,
    test?: boolean,
): boolean => {
    if (first.acceptableSlots === undefined) return false;

    return first.acceptableSlots.some((a) => {
        if (second.acceptableSlots === undefined) return true;

        return second.acceptableSlots.some((b) => {
            if (test === true) {
                console.log(`${first.name}: ${a.index}.${a.score} vs ${second.name}: ${b.index}.${b.score}`);
            }

            if (a.index !== b.index) {
                if (test === true) {
                    console.log("a.index !== b.index", a.index < b.index);
                }
                return a.index < b.index;
            }

            if (a.score !== b.score) {
                if (test === true) {
                    console.log("a.score !== b.score", a.score < b.score);
                }
                return a.score < b.score;
            }

            // alphabetical within group
            if (alphabetical || areSlotsAlphabeticallySorted(a, b)) {
                if (test === true) {
                    console.log(areSlotsAlphabeticallySorted(a, b));
                }
                return collator.compare(first.name, second.name) <= 0;
            }

            // if nothing else triggers, we assume the order is fine
            // TODO: i'd rather be opinionated
            return true;
        });
    });
};

// TODO: add a global override?
const areSlotsAlphabeticallySorted = (a: AcceptableSlot, b: AcceptableSlot): boolean =>
    a.sort === "alphabetical" && b.sort === "alphabetical";

// TODO: there should only be one acceptable slot so maybe replace getAcceptableSlots entirely
const getAcceptableSlot = (memberInfo: MemberInfo, orderedSlots: Slot[]): AcceptableSlot => {
    const acceptableSlots = getAcceptableSlots(memberInfo, orderedSlots);
    if (!acceptableSlots[0]) throw new Error();
    return acceptableSlots[0];
};

const getAcceptableSlots = (memberInfo: MemberInfo, orderedSlots: Slot[]): AcceptableSlot[] =>
    orderedSlots
        .map((slot, index) => ({ index, score: scoreMember(memberInfo, slot), sort: slot.sort }))
        .filter(({ score }) => score > 0)
        // these two steps remove the slots that score lower than the highest slot?
        .sort((a, b) => b.score - a.score)
        .filter(({ score }, _i, array) => score === array[0]?.score)

        // sorts by the index
        // .sort((a, b) => b.index - a.index);
        .sort((a, b) => a.index - b.index);

const scoreMember = (memberInfo: MemberInfo, slot: Slot): number => {
    if (Object.keys(slot).length === 0) return 1;

    // TODO: using total score results in hard to predict behavior
    // e.g. an item that should end up in an earlier group can score higher with a later group.
    // we should always respect the user's group ordering
    // simply take the highest score (they're all equally weighted)

    // the reason we have totalScore is if we had [methods] followed by [private-methods], the more specific one should win
    // but this doesn't work when the specificity seems higher but isn't e.g. [private-methods] vs [getters] has 2 matchers on private methods and 1 on getters
    // the reason being that more specificity may be required for certain rules but not actually mean they should override everything else
    let totalScore = 0;
    let failed = false;
    for (const { property, test, value } of comparers) {
        if (slot[property] !== undefined) {
            if (test(memberInfo, slot)) {
                // totalScore += value;
                totalScore = Math.max(totalScore, value);
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
        // extracts group name
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

    slot.testName = getStringComparer(slot.name);

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

const getStringComparer = (str?: string): ((s: string) => boolean) => {
    if (str === undefined) {
        return () => true;
    }

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
    {
        property: "name",
        test: (m, s) => s.testName?.(m.name) === true,
        value: 10, // 100
    },
];

export const rule = createRule({
    create: sortClassMembersRule,
    defaultOptions: [defaultOptions],
    meta: {
        docs: {
            description:
                "Enforce consistent members order, optionally grouping private fields with their respective getters/setters.",
        },
        fixable: "code",
        messages: {
            accessorPair: "Expected accessor pair {{ source }} to come {{ expected }} {{ target }}.",
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
