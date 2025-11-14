import { isAccessor } from "./isAccessor";

import type { MemberInfo } from "../types";

export const getMemberDescription = (member: MemberInfo, { groupAccessors }: { groupAccessors?: boolean }): string => {
    if (member.kind === "constructor") {
        return "constructor";
    }

    let typeName;
    if (member.kind === null) {
        typeName = member.type;
    } else if (member.matchingAccessor !== undefined && groupAccessors === true) {
        typeName = "accessor pair";
    } else if (isAccessor(member)) {
        typeName = `${member.kind}ter`;
    } else {
        typeName = member.type;
    }

    return `${member.static ? "static " : ""}${typeName} ${member.name}`;
};
