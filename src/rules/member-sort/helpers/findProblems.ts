import { areMembersInCorrectOrder } from "./areMembersInCorrectOrder";
import { forEachPair } from "./forEachPair";

import type { MemberInfo, ProblemData, SortClassMembersConfig } from "../types";

export const findAccessorPairProblems = (members: MemberInfo[], options: SortClassMembersConfig): ProblemData[] => {
    const problems: ProblemData[] = [];
    if (options.accessorPairPositioning === "any") return problems;

    forEachPair(members, (first, second, firstIndex, secondIndex) => {
        if (first.matchingAccessor === second.id) {
            const outOfOrder =
                (options.accessorPairPositioning === "getThenSet" && first.kind !== "get") ||
                (options.accessorPairPositioning === "setThenGet" && first.kind !== "set");
            const outOfPosition = secondIndex - firstIndex !== 1;

            if (outOfOrder || outOfPosition) {
                const expected = outOfOrder ? "before" : "after";
                problems.push({ expected, source: second, target: first });
            }
        }
    });

    return problems;
};

export const findProblems = (members: MemberInfo[], options: SortClassMembersConfig): ProblemData[] => {
    const problems: ProblemData[] = [];

    forEachPair(members, (first, second) => {
        if (!areMembersInCorrectOrder(first, second, options)) {
            if (options.reportType !== "after") {
                problems.push({ expected: "before", source: second, target: first });
            }

            if (options.reportType !== "before") {
                // after will get ignored by fixes but is helpful to show. but does 2x the number of reported errors
                problems.push({ expected: "after", source: first, target: second });
            }
        }
    });

    return problems;
};
