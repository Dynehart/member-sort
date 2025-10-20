import type { RuleContext, RuleFix } from "@typescript-eslint/utils/ts-eslint";

import type { SortClassMembersConfig, MemberInfo } from "./types.ts";
import { TSESTree } from "@typescript-eslint/utils";

type ProblemData = {
    source: string;
    target: string;
    expected: string;
    more?: number;
    problem?: "problem" | "problems";
};

export const reportProblem = ({
    problem,
    message,
    context,
    stopAfterFirst,
    problemCount,
    groupAccessors,
}: {
    problem: {
        source: MemberInfo;
        target: MemberInfo;
        expected: string;
    };
    message: string;
    context: Readonly<RuleContext<"unorderedMember" | "unorderedClass", [SortClassMembersConfig]>>;
    stopAfterFirst: boolean;
    problemCount: number;
    groupAccessors?: boolean;
}): void => {
    const { source, target, expected } = problem;
    const reportData: ProblemData = {
        source: getMemberDescription(source, { groupAccessors }),
        target: getMemberDescription(target, { groupAccessors }),
        expected,
    };

    let messageId: "unorderedMember" | "unorderedClass" = "unorderedMember";
    if (stopAfterFirst && problemCount > 1) {
        messageId = "unorderedClass";
        message += " ({{ more }} similar {{ problem }} in this class)";
        reportData.more = problemCount - 1;
        reportData.problem = problemCount === 2 ? "problem" : "problems";
    }

    context.report({
        node: source.node,
        messageId,
        data: reportData,
        fix(fixer) {
            const fixes: RuleFix[] = [];
            if (expected !== "before") {
                return fixes; // 'after' is rarely safe
            }
            const sourceAfterToken = context.sourceCode.getTokenAfter(source.node);

            const sourceJSDoc = context.sourceCode.getCommentsBefore(source.node).slice(-1).pop();
            const targetJSDoc = context.sourceCode.getCommentsBefore(target.node).slice(-1).pop();
            const decorators = ("decorators" in target.node && target.node.decorators) || [];
            const targetDecorator = decorators.slice(-1).pop();
            const insertTargetNode = targetJSDoc || targetDecorator?.parent || target.node;
            const sourceText = [];

            if (sourceJSDoc) {
                fixes.push(fixer.remove(sourceJSDoc));
                sourceText.push(
                    `${context.sourceCode.getText(sourceJSDoc)}${determineNodeSeperator(sourceJSDoc, source.node)}`,
                );
            }

            fixes.push(fixer.remove(source.node));
            sourceText.push(
                `${context.sourceCode.getText(source.node)}${determineNodeSeperator(source.node, sourceAfterToken)}`,
            );
            fixes.push(fixer.insertTextBefore(insertTargetNode, sourceText.join("")));
            return fixes;
        },
    });
};

const getMemberDescription = (member: MemberInfo, { groupAccessors }: { groupAccessors?: boolean }): string => {
    if (member.kind === "constructor") {
        return "constructor";
    }

    let typeName;
    if (member.matchingAccessor && groupAccessors) {
        typeName = "accessor pair";
    } else if (isAccessor(member)) {
        typeName = `${member.kind}ter`;
    } else {
        typeName = member.type;
    }

    return `${member.static ? "static " : ""}${typeName} ${member.name}`;
};

export function isAccessor({ kind }: { kind?: string }) {
    return kind === "get" || kind === "set";
}

// TSESTree.BooleanToken | TSESTree.IdentifierToken | TSESTree.JSXIdentifierToken | TSESTree.JSXTextToken | TSESTree.KeywordToken | TSESTree.NullToken | TSESTree.NumericToken | TSESTree.PrivateIdentifierToken | TSESTree.PunctuatorToken | TSESTree.RegularExpressionToken | TSESTree.StringToken | TSESTree.TemplateToken | null
const determineNodeSeperator = (
    first:
        | TSESTree.Comment
        | TSESTree.Node
        | TSESTree.BooleanToken
        | TSESTree.IdentifierToken
        | TSESTree.JSXIdentifierToken
        | TSESTree.JSXTextToken
        | TSESTree.KeywordToken
        | TSESTree.NullToken
        | TSESTree.NumericToken
        | TSESTree.PrivateIdentifierToken
        | TSESTree.PunctuatorToken
        | TSESTree.RegularExpressionToken
        | TSESTree.StringToken
        | TSESTree.TemplateToken
        | undefined,
    second:
        | TSESTree.Comment
        | TSESTree.Node
        | TSESTree.BooleanToken
        | TSESTree.IdentifierToken
        | TSESTree.JSXIdentifierToken
        | TSESTree.JSXTextToken
        | TSESTree.KeywordToken
        | TSESTree.NullToken
        | TSESTree.NumericToken
        | TSESTree.PrivateIdentifierToken
        | TSESTree.PunctuatorToken
        | TSESTree.RegularExpressionToken
        | TSESTree.StringToken
        | TSESTree.TemplateToken
        | null,
): string => {
    return isTokenOnSameLine(first, second) ? " " : "\n";
};

const isTokenOnSameLine = (
    left:
        | TSESTree.Comment
        | TSESTree.Node
        | TSESTree.BooleanToken
        | TSESTree.IdentifierToken
        | TSESTree.JSXIdentifierToken
        | TSESTree.JSXTextToken
        | TSESTree.KeywordToken
        | TSESTree.NullToken
        | TSESTree.NumericToken
        | TSESTree.PrivateIdentifierToken
        | TSESTree.PunctuatorToken
        | TSESTree.RegularExpressionToken
        | TSESTree.StringToken
        | TSESTree.TemplateToken
        | undefined,
    right:
        | TSESTree.Comment
        | TSESTree.Node
        | TSESTree.BooleanToken
        | TSESTree.IdentifierToken
        | TSESTree.JSXIdentifierToken
        | TSESTree.JSXTextToken
        | TSESTree.KeywordToken
        | TSESTree.NullToken
        | TSESTree.NumericToken
        | TSESTree.PrivateIdentifierToken
        | TSESTree.PunctuatorToken
        | TSESTree.RegularExpressionToken
        | TSESTree.StringToken
        | TSESTree.TemplateToken
        | null,
): boolean => {
    return left?.loc.end.line === right?.loc.start.line;
};
