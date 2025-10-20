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
                                    type: "string", // Added 'type'
                                    enum: ["public", "private", "protected"],
                                },
                                accessorPair: { type: "boolean" },
                                async: { type: "boolean" },
                                groupByDecorator: { oneOf: [{ type: "string" }, { type: "boolean" }] },
                                kind: {
                                    type: "string", // Added 'type'
                                    enum: ["get", "set", "accessor", "nonAccessor"],
                                },
                                name: { type: "string" },
                                override: { type: "boolean" },
                                private: { type: "boolean" },
                                propertyType: { type: "string" },
                                readonly: { type: "boolean" },
                                sort: {
                                    type: "string", // Added 'type'
                                    enum: ["alphabetical", "none"],
                                },
                                static: { type: "boolean" },
                                type: {
                                    type: "string", // Added 'type'
                                    enum: ["method", "property"],
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
                type: "string",
                enum: ["getThenSet", "setThenGet", "together", "any"],
            },
            groupPrivateWithAccessors: {
                type: "boolean",
            },
            groups: {
                type: "object",
                additionalProperties: false,
                patternProperties: {
                    "^.+$": { $ref: "#/definitions/order" },
                },
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
