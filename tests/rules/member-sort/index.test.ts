import { expect, test } from "vitest";
import { isAccessor } from "../../../src/rules/member-sort/reporter";
import { MemberInfo } from "../../../src/rules/member-sort/types";
import { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

test("isAccessor", () => {
    const node: TSESTree.AccessorProperty = {
        type: AST_NODE_TYPES.AccessorProperty,
        parent: undefined,
        computed: false,
        key: 'key',
        accessibility: 'private',
    };

    const member: MemberInfo = {
        name: "",
        type: "method",
        decorators: [],
        abstract: false,
        readonly: false,
        async: false,
        private: false,
        accessibility: "private",
        node,
    };
    expect(isAccessor(member)).toBe(false);
});

test("isAccessor", () => {
    const node: TSESTree.AccessorProperty = {};
    const member: MemberInfo = {
        name: "",
        type: "method",
        kind: "get",
        decorators: [],
        abstract: false,
        readonly: false,
        async: false,
        private: false,
        accessibility: "private",
        node,
    };
    expect(isAccessor(member)).toBe(true);
});
