import { ESLintUtils } from "@typescript-eslint/utils";

import { defaultOptions } from "./options";
import { schema } from "./schema";
import { sortClassMembersRule } from "./sort-member";

const createRule = ESLintUtils.RuleCreator((name) => `https://example.com/rule/${name}`);

export const memberSort = createRule({
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
