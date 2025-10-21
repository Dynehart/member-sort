export const defaultOptions = {
    // accessorPairPositioning: "together",
    accessorPairPositioning: "getThenSet",
    groupPrivateWithAccessors: true,
    groups: {
        "accessors": [
            { name: "/on.+/", type: "method" },
            "[accessor-pairs]",
            "[conventional-private-methods]",
            "[getters]",
            "[setters]",
        ],
        "event-handlers": [{ name: "/on.+/", type: "method" }, "[conventional-private-methods]"],
    },
    order: [
        "[static-properties]",
        "[static-methods]",
        "[properties]",
        "[conventional-private-properties]",
        "constructor",
        // "[accessors]",
        // "[event-handlers]", // reference the custom group defined in the "groups" property
        "[methods]",
        // "[conventional-private-methods]",
        "[everything-else]",
    ],
    stopAfterFirstProblem: true,
};
