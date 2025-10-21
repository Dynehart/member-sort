import { TSESTree } from "@typescript-eslint/utils";

export type AcceptableSlot = {
    index: number;
    score: number;
    sort?: "alphabetical" | "none";
};

export type OrderType = "method" | "property";

export type Kind = "constructor" | "get" | "method" | "set" | null;


// export declare type ClassElement = AccessorProperty | MethodDefinition | PropertyDefinition | StaticBlock | TSAbstractAccessorProperty | TSAbstractMethodDefinition | TSAbstractPropertyDefinition | TSIndexSignature;
type Member = {
    name: string;
    type: OrderType;
    decorators: string[];

    abstract: boolean;
    async: boolean;
    override: boolean;
    private: boolean;
    readonly: boolean;
    static: boolean;

    accessibility: "public" | "protected" | "private";
    // only properties seem to have no kind on the node
    kind: Kind

    propertyType?: string; //
};

type MemberStuff = Omit<Member, 'kind'> & {
    kind: "constructor" | "get" | "method" | "set" | "accessor" | "nonAccessor";
    accessorPair?: boolean;
    groupByDecorator?: string | boolean;
    sort?: "alphabetical" | "none";
    testName?: (s: string) => boolean;
    group?: string;
};

export type MemberInfo = Member & {
    node: TSESTree.ClassElement;

    hasGetter?: boolean;

    // These are added later in the pipeline:
    id?: string;
    subid?: string;

    acceptableSlots?: AcceptableSlot[];
    matchingAccessor?: string;
    isFirstAccessor?: boolean;
};

export const OrderTypes: { method: OrderType; property: OrderType } = {
    method: "method",
    property: "property",
};

export type OrderItem = string | Partial<MemberStuff>;

export type Slots = Slots[] | Partial<MemberStuff>;

// Slot === Order
export type Slot = Exclude<OrderItem, string>;
export type Order = OrderItem | OrderItem[];

export type Groups = Record<string, Order>;

export type SortClassMembersConfig = {
    accessorPairPositioning: "getThenSet" | "setThenGet" | "together" | "any";
    groupPrivateWithAccessors: boolean;
    groups: Groups;
    locale: string;
    order: OrderItem[];
    sortInterfaces: boolean;
    stopAfterFirstProblem: boolean;
    alphabetical: boolean;
};

export type SortClassMembersConfigInput = {
    accessorPairPositioning?: "getThenSet" | "setThenGet" | "together" | "any";
    groupPrivateWithAccessors?: boolean;
    groups?: Groups;
    locale?: string;
    order?: OrderItem[];
    sortInterfaces?: boolean;
    stopAfterFirstProblem?: boolean;
    alphabetical: boolean;
};

export type MessageIds = "unorderedMember" | "unorderedClass" | "noClassExpression" | "accessorPair"