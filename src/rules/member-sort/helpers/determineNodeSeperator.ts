import { TSESTree } from "@typescript-eslint/utils";
// TSESTree.BooleanToken | TSESTree.IdentifierToken | TSESTree.JSXIdentifierToken | TSESTree.JSXTextToken | TSESTree.KeywordToken | TSESTree.NullToken | TSESTree.NumericToken | TSESTree.PrivateIdentifierToken | TSESTree.PunctuatorToken | TSESTree.RegularExpressionToken | TSESTree.StringToken | TSESTree.TemplateToken | null
export const determineNodeSeperator = (
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
