import type { JSONSchema4 } from "@typescript-eslint/utils/json-schema";

export const schema: readonly JSONSchema4[] = [
    {
        additionalProperties: false,
        definitions: {
            order: {
                items: {
                    anyOf: [
                        { type: "string" },
                        {
                            additionalProperties: false,
                            properties: {
                                abstract: { type: "boolean" },
                                accessibility: {
                                    enum: ["public", "private", "protected"],
                                    type: "string",
                                },
                                accessorPair: { type: "boolean" },
                                async: { type: "boolean" },
                                groupByDecorator: { oneOf: [{ type: "string" }, { type: "boolean" }] },
                                kind: {
                                    enum: ["get", "set", "accessor", "nonAccessor"],
                                    type: "string",
                                },
                                name: { type: "string" },
                                override: { type: "boolean" },
                                private: { type: "boolean" },
                                propertyType: { type: "string" },
                                readonly: { type: "boolean" },
                                sort: {
                                    enum: ["alphabetical", "none"],
                                    type: "string",
                                },
                                static: { type: "boolean" },
                                type: {
                                    enum: ["method", "property"],
                                    type: "string",
                                },
                            },
                            type: "object",
                        },
                    ],
                },
                type: "array",
            },
        },
        id: "https://github.com/dynehart/eslint-plugin-member-order/v1",
        properties: {
            accessorPairPositioning: {
                enum: ["getThenSet", "setThenGet", "together", "any"],
                type: "string",
            },
            alphabetical: {
                type: "boolean",
            },
            groupPrivateWithAccessors: {
                type: "boolean",
            },
            groups: {
                additionalProperties: false,
                patternProperties: {
                    "^.+$": { $ref: "#/definitions/order" },
                },
                type: "object",
            },
            locale: {
                type: "string",
            },
            order: { $ref: "#/definitions/order" },
            sortInterfaces: {
                type: "boolean",
            },
            stopAfterFirstProblem: {
                type: "boolean",
            },
        },
        type: "object",
    },
];
