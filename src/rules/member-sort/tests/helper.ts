import type { MemberInfo, Slot } from "../types";

export const makeMember = (overrides: Partial<MemberInfo> = {}): MemberInfo =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({
        abstract: false,
        accessibility: undefined,
        async: false,
        decorators: [],
        kind: null,
        matchingAccessor: undefined,
        name: "foo",
        node: {} as unknown,
        override: false,
        private: false,
        readonly: false,
        static: false,
        type: "method",
        ...overrides,
    } as MemberInfo);

export const makeSlot = (overrides: Partial<Slot> = {}): Slot =>
    ({
        abstract: undefined,
        accessibility: undefined,
        async: undefined,
        groupByDecorator: undefined,
        kind: undefined,
        override: undefined,
        private: undefined,
        readonly: undefined,
        static: undefined,
        testName: undefined,
        type: undefined,
        ...overrides,
    } as Slot);
