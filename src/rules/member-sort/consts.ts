import { AST_NODE_TYPES } from "@typescript-eslint/utils";

import type { OrderType, SortClassMembersConfig } from "./types";

export const defaultOptions: SortClassMembersConfig = {
    accessorPairPositioning: "getThenSet",
    alphabetical: true,
    groupPrivateWithAccessors: true,
    // TODO: use these groupings: https://typescript-eslint.io/rules/member-ordering/
    groups: {
        "accessor-pairs": [{ accessorPair: true }],
        "arrow-function-properties": [{ propertyType: AST_NODE_TYPES.ArrowFunctionExpression }],
        "async-methods": [{ async: true, type: "method" }],
        // this one behaves weirdly because the constructor keyword throws of TS so the cast is necessary
        "constructor": [{ name: "constructor", type: "method" as OrderType }],
        "conventional-private-methods": [{ name: "/_.+/", type: "method" }],
        "conventional-private-properties": [{ name: "/_.+/", type: "property" }],
        // "event-handlers": [{ name: "/on.+/", type: "method" }, "[conventional-private-methods]"],
        "everything-else": [{}],
        "getters": [{ kind: "get" }],
        "methods": [{ type: "method" }],
        "private-getters": [{ accessibility: "private", kind: "get" }],
        "private-methods": [{ accessibility: "private", type: "method" }],
        "private-properties": [{ accessibility: "private", type: "property" }],
        "private-setters": [{ accessibility: "private", kind: "set" }],
        "private-static-properties": [{ accessibility: "private", static: true, type: "property" }],
        "properties": [{ type: "property" }],
        "protected-getters": [{ accessibility: "protected", kind: "get" }],
        "protected-methods": [{ accessibility: "protected", type: "method" }],
        "protected-properties": [{ accessibility: "protected", type: "property" }],
        "protected-setters": [{ accessibility: "protected", kind: "set" }],
        "public-getters": [{ accessibility: "public", kind: "get" }],
        "public-methods": [{ accessibility: "public", type: "method" }],
        "public-properties": [{ accessibility: "public", type: "property" }],
        "public-setters": [{ accessibility: "public", kind: "set" }],
        "public-static-properties": [{ accessibility: "public", static: true, type: "property" }],
        "setters": [{ kind: "set" }],
        "static-methods": [{ static: true, type: "method" }],
        "static-properties": [{ static: true, type: "property" }],
        // "accessor-pairs": [{ accessorPair: true }],
        // "arrow-function-properties": { propertyType: "ArrowFunctionExpression" },
        // "async-methods": { async: true, type: "method" },
        // "constructor": { name: "constructor", type: OrderTypes.method },
        // "conventional-private-methods": { name: "/_.+/", type: "method" },
        // "conventional-private-properties": { name: "/_.+/", type: "property" },
        // // "event-handlers": [{ name: "/on.+/", type: "method" }, "[conventional-private-methods]"],
        // "everything-else": {},
        // "getters": { kind: "get" },
        // "methods": { type: "method" },
        // "properties": { type: "property" },
        // "setters": { kind: "set" },
        // "static-methods": { static: true, type: "method" },
        // "static-properties": { static: true, type: "property" },
    },
    locale: "en-US",
    order: [
        "[public-static-properties]",
        "[private-static-properties]",

        "[static-properties]",
        "[static-methods]",

        "[public-properties]",
        "[protected-properties]",
        "[private-properties]",

        "[properties]",

        "[constructor]",

        "[public-getters]",
        "[protected-getters]",
        "[private-getters]",

        "[public-methods]",
        "[protected-methods]",
        "[private-methods]",
        "[methods]",

        "[conventional-private-methods]",
        "[everything-else]",
    ],
    reportType: "single",
    sortInterfaces: false,
    stopAfterFirstProblem: true,
};

export const phaserOptions: SortClassMembersConfig = {
    ...defaultOptions,
    order: [
        "[public-static-properties]",
        "[private-static-properties]",

        "[static-properties]",
        "[static-methods]",

        "[public-properties]",
        "[protected-properties]",
        "[private-properties]",

        "[properties]",

        "[public-getters]",
        "[protected-getters]",
        "[private-getters]",

        "constructor",

        // Phaser lifecycle
        "init",
        "preload",
        "create",
        "update",
        "shutdown",
        "destroy",

        // "[event-handlers]", // reference the custom group defined in the "groups" property


        "[public-methods]",
        "[protected-methods]",
        "[private-methods]",
        "[methods]",

        "[conventional-private-methods]",
        "[everything-else]",
    ],
};
