import { TSESTree } from "@typescript-eslint/utils";

import type { Context, MemberInfo, MessageIds, ReportProblem } from "./types.ts";
import type { RuleFix } from "@typescript-eslint/utils/ts-eslint";

type ProblemData = {
    source: string;
    target: string;
    expected: string;
    more?: number;
    problem?: "problem" | "problems";
};

export const reportProblems = (context: Context, messageId: MessageIds, problems: ReportProblem[]): void => {
    const options = context.options[0];

    for (const problem of problems) {
        reportProblem({
            context,
            messageId,
            problem,
            problemCount: problems.length,
        });
        if (options.reportType === "single") break;
    }
};

export const reportProblem = ({
    context,
    messageId,
    problem,
    problemCount,
}: {
    context: Context;
    problem: {
        source: MemberInfo;
        target: MemberInfo;
        expected: string;
    };
    messageId: MessageIds;
    problemCount: number;
}): void => {
    const options = context.options[0];

    const { expected, source, target } = problem;
    const reportData: ProblemData = {
        expected,
        source: getMemberDescription(source, { groupAccessors: options.accessorPairPositioning !== "any" }),
        target: getMemberDescription(target, { groupAccessors: options.accessorPairPositioning !== "any" }),
    };

    if (options.reportType === "single" && problemCount > 1) {
        messageId = "unorderedClass";

        reportData.more = problemCount - 1;
        reportData.problem = problemCount === 2 ? "problem" : "problems";
    }

    context.report({
        data: reportData,
        fix(fixer) {
            const fixes: RuleFix[] = [];
            if (expected !== "before") {
                return fixes; // 'after' is rarely safe
            }
            const spacing: string = " ".repeat(source.node.loc.start.column);

            const sourceAfterToken = context.sourceCode.getTokenAfter(source.node);

            // .slice is to prevent modification of the original array
            const targetComments: TSESTree.Comment[] = context.sourceCode.getCommentsBefore(target.node);

            const decorators = "decorators" in target.node ? target.node.decorators : [];
            // TODO: this is a problem with multiple decorators
            const targetDecorator = decorators.slice(-1).pop();
            const insertTargetNode = targetComments[0] ?? targetDecorator?.parent ?? target.node;
            const sourceText: string[] = [];

            const sourceComments: TSESTree.Comment[] = context.sourceCode.getCommentsBefore(source.node);

            if (sourceComments[0] !== undefined) {
                // check for just the first element instead of length to make access easier
                let prevLine = sourceComments[0].loc.start.line - 1;

                for (const comment of sourceComments) {
                    const newlines = "\n".repeat(comment.loc.start.line - prevLine - 1);
                    prevLine = comment.loc.end.line;

                    // only happens when it's a line comment.
                    // TODO: I'm assuming formatting issues if the comment start is less than the node start
                    if (comment.loc.start.column > source.node.loc.start.column) {
                        continue;
                    }

                    fixes.push(fixer.remove(comment));
                    sourceText.push(
                        // the very first
                        `${newlines}${spacing}${context.sourceCode.getText(comment)}${determineNodeSeperator(
                            comment,
                            source.node,
                        )}`,
                    );
                }
            }

            fixes.push(fixer.remove(source.node));
            sourceText.push(
                `${spacing}${context.sourceCode.getText(source.node)}${determineNodeSeperator(
                    source.node,
                    sourceAfterToken,
                )}`,
            );

            if (sourceAfterToken) {
                const emptyLines = sourceAfterToken.loc.start.line - source.node.loc.end.line;
                // remove any empty lines after the node including self
                if (emptyLines > 0) {
                    fixes.push(fixer.removeRange([source.node.range[1], sourceAfterToken.range[0]]));
                }
            }

            // if (target.isLazyLoader !== true) {}
            // newline for any nodes other than accessors
            sourceText.push("\n");
            // spacing for the node we're inserting before
            sourceText.push(" ".repeat(insertTargetNode.loc.start.column));

            // TODO: something is adding an unexpected indentation I can't get rid of easily
            // fixes.push(fixer.insertTextBeforeRange([insertTargetNode.range[0]-insertTargetNode.loc.start.column, insertTargetNode.range[1]], sourceText.join("")));
            fixes.push(
                fixer.replaceTextRange(
                    [insertTargetNode.range[0] - insertTargetNode.loc.start.column, insertTargetNode.range[0]],
                    sourceText.join(""),
                ),
            );
            // fixes.push(fixer.insertTextBefore(insertTargetNode, sourceText.join("")));
            return fixes;
        },
        messageId,
        node: source.node,
    });
};

const getMemberDescription = (member: MemberInfo, { groupAccessors }: { groupAccessors?: boolean }): string => {
    if (member.kind === "constructor") {
        return "constructor";
    }

    let typeName;
    if (member.kind === null) {
        typeName = member.type;
    } else if (member.matchingAccessor !== undefined && groupAccessors === true) {
        typeName = "accessor pair";
    } else if (isAccessor(member)) {
        typeName = `${member.kind}ter`;
    } else {
        typeName = member.type;
    }

    return `${member.static ? "static " : ""}${typeName} ${member.name}`;
};

export const isAccessor = ({ kind }: MemberInfo): boolean => kind === "get" || kind === "set";

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
): string => (isTokenOnSameLine(first, second) ? " " : "\n");

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
): boolean => left?.loc.end.line === right?.loc.start.line;
