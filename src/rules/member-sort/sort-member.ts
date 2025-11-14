import { AST_NODE_TYPES, AST_TOKEN_TYPES, ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";

import { comparers } from "./comparers";
import {
    areMembersInCorrectOrder,
    findAccessorPairProblems,
    findProblems,
    forEachPair,
    getExpectedOrder,
    isAccessor,
    normalizePrivateName,
} from "./helpers";
import { reportProblems } from "./reporter";
import { AccessorGrouping } from "./types";

import type { AcceptableSlot, ClassMember, Context, Kind, MemberInfo, Slot } from "./types";
import type { RuleFunction } from "@typescript-eslint/utils/ts-eslint";

export const sortClassMembersRule = (context: Context): ESLintUtils.RuleListener => {
    const options = context.options[0];

    const orderedSlots = getExpectedOrder(options);

    const ClassDeclaration: RuleFunction<TSESTree.ClassDeclaration | TSESTree.ClassExpression> = (
        node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    ) => {
        let members = getClassMemberInfos(node, context.sourceCode, orderedSlots);

        // check for out-of-order and separated get/set pairs
        const accessorPairProblems = findAccessorPairProblems(members, options);
        reportProblems(context, "accessorPair", accessorPairProblems);

        // this removes any accessors that are tied to their other respective accessor?
        members = members.filter((m) => !(m.matchingAccessor !== undefined && m.isFirstAccessor === true));

        if (options.groupPrivateWithAccessors) {
            forEachPair(members, (first, second) => {
                areMembersInCorrectOrder(first, second, options);
            });

            groupFieldsWithAccessors(members, options.groupWithAccessors === AccessorGrouping.Private);
        }

        const problems = findProblems(members, options);
        reportProblems(context, "unorderedMember", problems);
    };

    const rules: ESLintUtils.RuleListener = {
        ClassDeclaration,
        ClassExpression: ClassDeclaration,
    };

    // if (options.sortInterfaces) {
    //     rules.TSInterfaceDeclaration = rules.ClassDeclaration;
    // }

    return rules;
};

const groupFieldsWithAccessors = (members: MemberInfo[], privateFields: boolean): void => {
    const used = new Set<string>();

    for (const member of members) {
        if (used.has(member.name)) continue;

        // we only need to check private properties `private _foo` or `#foo`
        // TODO: does it make sense to limit this to just private props?
        if (member.type === "property" && (member.private || !privateFields)) {
            const baseName = normalizePrivateName(member.name);

            const matching = members
                // Find accessors with same name as the normalized name and the same staticness
                .filter((m) => !used.has(m.name) && isAccessor(m) && m.static === member.static && m.name === baseName)
                // TODO: there shouldn't be multiple accessors
                .filter((m) => m.isFirstAccessor ?? true);

            // these are private field without getter/setter
            if (!matching[0]) {
                used.add(member.name);
                continue;
            }

            if (!matching[0].acceptableSlots) throw new Error("should not happen");

            const slot = matching[0].acceptableSlots[0];
            if (!slot) throw new Error("should not happen");

            member.acceptableSlots = [{ ...slot, score: slot.score - 1 }];
            // mark both getter/setters as used
            matching.forEach((m) => used.add(m.name));
        }

        used.add(member.name);
    }
};

const getClassMemberInfos = (
    classDeclaration: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    sourceCode: Readonly<TSESLint.SourceCode>,
    orderedSlots: Slot[],
): MemberInfo[] => {
    const classMemberNodes = classDeclaration.body.body;

    const filtered: ClassMember[] = classMemberNodes
        .filter((x) => x.type !== AST_NODE_TYPES.StaticBlock)
        .filter((x) => x.type !== AST_NODE_TYPES.TSIndexSignature);

    const members = filtered
        .map((member, id) => getMemberInfo(member, sourceCode, id))
        .map((memberInfo, _i, memberInfos) => {
            matchAccessorPairs(memberInfos);
            const acceptableSlots = [getAcceptableSlot(memberInfo, orderedSlots)];
            return { ...memberInfo, acceptableSlots };
        });

    return members;
};

const getMemberInfo = (node: ClassMember, sourceCode: Readonly<TSESLint.SourceCode>, id: number): MemberInfo => {
    const isPrivate = node.key.type === AST_NODE_TYPES.PrivateIdentifier || node.accessibility === "private";
    let name: string;
    let type: "property" | "method";
    let propertyType: AST_NODE_TYPES | undefined;
    let async = false;
    let kind: Kind;

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
            // TSESTree.PropertyDefinitionComputedName | TSESTree.PropertyDefinitionNonComputedName | TSESTree.TSAbstractPropertyDefinitionComputedName | TSESTree.TSAbstractPropertyDefinitionNonComputedName
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
        }
    } else {
        type = "method";

        if (node.computed) {
            const keyBeforeToken = sourceCode.getTokenBefore(node.key);
            const keyAfterToken = sourceCode.getTokenAfter(node.key);

            if (!keyBeforeToken || !keyAfterToken) {
                throw new Error("there needs to be a before and after token");
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

    const member: MemberInfo = {
        abstract,
        accessibility,
        async,
        decorators,
        id: id.toString(),
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
    return member;
};

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
        .sort((a, b) => b.score - a.score)
        .filter(({ score }, _i, array) => score === array[0]?.score)
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

const matchAccessorPairs = (members: MemberInfo[]): void => {
    forEachPair(members, (first, second) => {
        const isMatch = first.name === second.name && first.static === second.static;
        if (isAccessor(first) && isAccessor(second) && isMatch) {
            first.isFirstAccessor = true;
            first.matchingAccessor = second.id;
            second.matchingAccessor = first.id;
        }
    });
};
