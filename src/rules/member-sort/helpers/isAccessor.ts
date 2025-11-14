import type { MemberInfo } from "../types";

export const isAccessor = ({ kind }: MemberInfo): boolean => kind === "get" || kind === "set";
