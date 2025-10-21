import { AST_TOKEN_TYPES, TSESTree } from "@typescript-eslint/utils";

import type { MemberInfo, MessageIds, SortClassMembersConfig } from "./types.ts";
import type { RuleContext, RuleFix } from "@typescript-eslint/utils/ts-eslint";

type ProblemData = {
    source: string;
    target: string;
    expected: string;
    more?: number;
    problem?: "problem" | "problems";
};

const getComments = (
    context: Readonly<RuleContext<MessageIds, [SortClassMembersConfig]>>,
    source: MemberInfo,
): TSESTree.Node => {
    // .slice(-1).pop(); ???
    const comments: TSESTree.Comment[] = context.sourceCode.getCommentsBefore(source.node);
    // TODO: maintain spacing
    return comments;
};

export const reportProblem = ({
    context,
    groupAccessors,
    messageId,
    problem,
    problemCount,
    stopAfterFirst,
}: {
    problem: {
        source: MemberInfo;
        target: MemberInfo;
        expected: string;
    };
    messageId: MessageIds;
    context: Readonly<RuleContext<MessageIds, [SortClassMembersConfig]>>;
    stopAfterFirst: boolean;
    problemCount: number;
    groupAccessors?: boolean;
}): void => {
    const { expected, source, target } = problem;
    const reportData: ProblemData = {
        expected,
        source: getMemberDescription(source, { groupAccessors }),
        target: getMemberDescription(target, { groupAccessors }),
    };

    if (stopAfterFirst && problemCount > 1) {
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

            const sourceJSDoc = context.sourceCode.getCommentsBefore(source.node).slice(-1).pop();

            // .slice is to prevent modification of the original array
            const targetJSDoc = context.sourceCode.getCommentsBefore(target.node).slice(-1).pop();
            const decorators = "decorators" in target.node ? target.node.decorators : [];
            // TODO: this is a problem with multiple decorators
            const targetDecorator = decorators.slice(-1).pop();
            const insertTargetNode = targetJSDoc ?? targetDecorator?.parent ?? target.node;
            const sourceText: string[] = ["\n"];

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
                        // // this fucks up comments on the same line as the previous node
                        `${newlines}${spacing}${context.sourceCode.getText(comment)}${determineNodeSeperator(
                            comment,
                            source.node,
                        )}`,
                    );
                }
            }

            // if (sourceJSDoc) {
            //     fixes.push(fixer.remove(sourceJSDoc));
            //     sourceText.push(
            //         `${context.sourceCode.getText(sourceJSDoc)}${determineNodeSeperator(sourceJSDoc, source.node)}`,
            //     );
            // }

            fixes.push(fixer.remove(source.node));
            sourceText.push(
                `${spacing}${context.sourceCode.getText(source.node)}${determineNodeSeperator(
                    source.node,
                    sourceAfterToken,
                )}`,
            );

            // newline + spacing for the node we're inserting before
            if (source.private)
            sourceText.push("\n")
            sourceText.push(" ".repeat(insertTargetNode.loc.start.column));

            fixes.push(fixer.insertTextBefore(insertTargetNode, sourceText.join("")));
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
