import { TSESTree } from "@typescript-eslint/utils";

export type AcceptableSlot = {
    index: number;
    score: number;
    sort?: "alphabetical" | "none";
};

export type MemberInfo = {
    name: string;
    type: "method" | "property";
    decorators: string[];
    static?: boolean;
    abstract: boolean;
    override?: boolean;
    readonly: boolean;
    async: boolean;
    private: boolean;
    accessibility: "public" | "private" | "protected";
    kind?: string;
    propertyType?: string;
    node: TSESTree.ClassElement;

    // These are added later in the pipeline:
    id?: string;
    acceptableSlots?: AcceptableSlot[];
    matchingAccessor?: string;
    isFirstAccessor?: boolean;
};

export type Slots =
    | Slots[]
    | {
          name?: string;
          type?: "method" | "property";
          kind?: "get" | "set" | "accessor" | "nonAccessor";
          static?: boolean;
          async?: boolean;
          private?: boolean;
          accessibility?: "public" | "protected" | "private";
          abstract?: boolean;
          override?: boolean;
          readonly?: boolean;
          propertyType?: string;
          accessorPair?: boolean;
          groupByDecorator?: string | boolean;
          testName?: (s: string) => boolean;
          sort?: "alphabetical" | "none";

          group?: string;
      };

export type Slot = Exclude<Slots, Slots[]>;

export type OrderType = "method" | "property";

export const OrderTypes: { method: OrderType; property: OrderType } = {
    method: "method",
    property: "property",
};

export type OrderItem =
    | string
    | {
          abstract?: boolean;
          accessibility?: "public" | "private" | "protected";
          accessorPair?: boolean;
          async?: boolean;
          groupByDecorator?: string | boolean;
          kind?: "get" | "set" | "accessor" | "nonAccessor";
          name?: string;
          override?: boolean;
          private?: boolean;
          propertyType?: string;
          readonly?: boolean;
          sort?: "alphabetical" | "none";
          static?: boolean;
          type?: OrderType;
      };

export type Order = OrderItem | OrderItem[];

export type Groups = {
    [groupName: string]: Order;
};

export type SortClassMembersConfig = {
    accessorPairPositioning?: "getThenSet" | "setThenGet" | "together" | "any";
    groupPrivateWithAccessors?: boolean;
    groups?: Groups;
    locale?: string;
    order?: OrderItem[];
    sortInterfaces?: boolean;
    stopAfterFirstProblem?: boolean;
};
