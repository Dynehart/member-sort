import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import { expect, test } from "vitest";

import { isAccessor } from "../helpers";

import type { MemberInfo } from "../types";

test("isAccessor", () => {
    const node: TSESTree.AccessorProperty = {
        accessibility: "private",
        computed: false,
        key: "key",
        parent: undefined,
        type: AST_NODE_TYPES.AccessorProperty,
    };

    const member: MemberInfo = {
        abstract: false,
        accessibility: "private",
        async: false,
        decorators: [],
        name: "",
        node,
        private: false,
        readonly: false,
        type: "method",
    };
    expect(isAccessor(member)).toBe(false);
});

test("isAccessor", () => {
    const node: TSESTree.AccessorProperty = {};
    const member: MemberInfo = {
        abstract: false,
        accessibility: "private",
        async: false,
        decorators: [],
        kind: "get",
        name: "",
        node,
        private: false,
        readonly: false,
        type: "method",
    };
    expect(isAccessor(member)).toBe(true);
});
