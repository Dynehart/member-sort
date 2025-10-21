import { defaultOptions, memberSort } from "./rules";

export const rules = {
    "member-sort/member-sort": ["error", defaultOptions],
};

// eslint-disable-next-line no-restricted-syntax, import/no-default-export
export default {
    meta: {
        name: "member-sort",
        version: "0.1",
    },
    rules: {
        "member-sort": memberSort,
    },
};
