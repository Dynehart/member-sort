import { getStringComparer, isAccessor } from "./helpers";

import type { Comparer, MemberInfo, Slot } from "./types";

export const comparers: Comparer[] = [
    { property: "type", test: (m, s) => s.type === m.type, value: 10 },
    { property: "static", test: (m, s) => s.static === m.static, value: 10 },
    { property: "accessibility", test: (m, s) => s.accessibility === m.accessibility, value: 10 },
    { property: "private", test: (m, s) => s.private === m.private, value: 10 },
    {
        property: "kind",
        test: (m: MemberInfo, s: Slot): boolean => {
            if (s.kind === "accessor") return isAccessor(m);
            else if (s.kind === "nonAccessor") return !isAccessor(m);
            return s.kind === m.kind;
        },
        value: 10,
    },
    { property: "abstract", test: (m, s) => s.abstract === m.abstract, value: 10 },
    { property: "override", test: (m, s) => s.override === m.override, value: 10 },
    { property: "readonly", test: (m, s) => s.readonly === m.readonly, value: 10 },
    { property: "async", test: (m, s) => s.async === m.async, value: 10 },
    {
        property: "groupByDecorator",
        test: (m: MemberInfo, s: Slot): boolean => {
            if (s.groupByDecorator === undefined) return false;
            if (typeof s.groupByDecorator === "boolean") {
                return s.groupByDecorator === m.decorators.length > 0;
            }
            const comparer = getStringComparer(s.groupByDecorator);
            return m.decorators.some((decorator) => comparer(decorator));
        },
        value: 10,
    },
    {
        property: "accessorPair",
        test: (m) => isAccessor(m) && m.matchingAccessor !== undefined,
        value: 10,
    },
    {
        property: "name",
        test: (m, s) => s.testName?.(m.name) === true,
        value: 10,
    },
];
