import { AST_NODE_TYPES, AST_TOKEN_TYPES, ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";

import { comparers, getStringComparer } from "./helpers";
import { isAccessor, reportProblem } from "./reporter";

import type {
    AcceptableSlot,
    Group,
    Groups,
    Kind,
    MemberInfo,
    MessageIds,
    OrderItem,
    Slot,
    Slots,
    SortClassMembersConfig,
} from "./types";
import type { RuleContext, RuleFunction } from "@typescript-eslint/utils/ts-eslint";

export const sortClassMembersRule = (
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

        // this removes any accessors that are tied to their other respective accessor?
        members = members.filter((m) => !(m.matchingAccessor !== undefined && m.isFirstAccessor === true));

        if (groupPrivateWithAccessors) {
            const collator = new Intl.Collator(locale);

            forEachPair(members, (first, second) => {
                updateMemberScores(first, second, collator, options.alphabetical);
            });

            groupPrivateFieldsWithAccessors(members);
        }

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

    // for now I just disallow ClassExpressions
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
    const used = new Set<string>();

    for (const member of members) {
        if (member.id !== undefined && used.has(member.name)) {
            continue;
        }
        if (member.id === undefined) {
            throw new Error(`${member.name} has not had an id set`);
        }

        // we only apply this to `private _foo` or `#foo`
        if (member.type === "property" && member.private) {
            // compute the canonical base name to match against accessors
            // supports "#foo", "_foo" and "__foo" and plain "foo"
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
                // TODO: there shouldn't be multiple accessors
                .filter((m) => m.isFirstAccessor ?? true);

            // private field without getter/setter
            if (!matching[0]) {
                used.add(member.name);
                continue;
            }

            if (!matching[0].acceptableSlots) {
                throw new Error();
            }

            const slot = matching[0].acceptableSlots[0];
            if (slot) {
                matching[0].isLazyLoader = true;
                member.acceptableSlots = [{ ...slot, score: slot.score - 1 }];
            } else {
                throw new Error("should not happen");
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

    const accessibility = node.accessibility ?? "public";
    const abstract =
        node.type === AST_NODE_TYPES.TSAbstractAccessorProperty ||
        node.type === AST_NODE_TYPES.TSAbstractPropertyDefinition ||
        node.type === AST_NODE_TYPES.TSAbstractMethodDefinition;

    const decorators = node.decorators.map(({ expression }) => {
        if (expression.type === AST_NODE_TYPES.CallExpression && "name" in expression.callee) {
            return expression.callee.name;
        }

        if ("name" in expression) {
            return expression.name;
        }

        return "";
    });

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
        if (!areMembersInCorrectOrder(first, second, collator, alphabetical)) {
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

/**
 * this is done so that the scores of the getter/setters have enough distance to put the private fields between them
 * e.g. the public accessibility of zIndex makes this the correct order here (using default settings)
 * ```
 * class Foo {
 *   #zIndex: number
 *   public get zIndex(): number {...}
 *   #bounds: [number, number]
 *   private get bounds(): [number, number] {...}
 * }
 * ```
 * to accomplish this, we group all into the same group index but increment the score of `bounds` by 10
 * then each private field is set to `getter.slot.score-1` such that.
 *
 * `#zIndex: 9, zIndex:10, #bounds:19, bounds: 20`
 */
const updateMemberScores = (
    first: MemberInfo,
    second: MemberInfo,
    collator: Intl.Collator,
    alphabetical: boolean,
): void => {
    if (first.acceptableSlots?.[0] === undefined) return;

    first.acceptableSlots.forEach((a) => {
        if (second.acceptableSlots === undefined) return;

        second.acceptableSlots.forEach((b) => {
            if (a.index !== b.index) return;
            if (a.score !== b.score) return;

            // alphabetical within group
            if (alphabetical || areSlotsAlphabeticallySorted(a, b)) {
                if (collator.compare(first.name, second.name) <= 0) {
                    b.score = a.score + 10;
                } else {
                    a.score = b.score + 10;
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
): boolean => {
    if (first.acceptableSlots === undefined) return false;

    return first.acceptableSlots.some((a) => {
        if (second.acceptableSlots === undefined) return true;

        return second.acceptableSlots.some((b) => {
            if (a.index !== b.index) return a.index < b.index;
            if (a.score !== b.score) return a.score < b.score;

            // alphabetical within group
            if (alphabetical || areSlotsAlphabeticallySorted(a, b)) {
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

const expandSlot = (input: Group, groups: Groups): Slots[] => {
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

const flatten = <T>(collection: (T | T[])[]): T[] => {
    const result = [];
    for (const item of collection) {
        if (Array.isArray(item)) result.push(...flatten(item));
        else result.push(item);
    }
    return result;
};
