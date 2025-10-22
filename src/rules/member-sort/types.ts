import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";

export type ClassMember = Exclude<TSESTree.ClassElement, TSESTree.StaticBlock | TSESTree.TSIndexSignature>;

export type Context = Readonly<RuleContext<MessageIds, [SortClassMembersConfig]>>;

export type AcceptableSlot = {
    index: number;
    score: number;
    sort?: "alphabetical" | "none";
};

export type OrderType = "method" | "property";
export type Accessibility = "public" | "protected" | "private"
export type Kind = "constructor" | "get" | "method" | "set" | null;

// TODO: probably can construct this using the actual types of ClassElement
// export declare type ClassElement = AccessorProperty | MethodDefinition | PropertyDefinition | StaticBlock | TSAbstractAccessorProperty | TSAbstractMethodDefinition | TSAbstractPropertyDefinition | TSIndexSignature;
type Member = {
    id: string;

    name: string;
    type: OrderType;
    decorators: string[];

    abstract: boolean;
    async: boolean;
    override: boolean;
    private: boolean;
    readonly: boolean;
    static: boolean;

    accessibility: Accessibility;
    // only properties seem to have no kind on the node
    kind: Kind;

    propertyType?: AST_NODE_TYPES;
};

export type Order = Omit<Member, "kind"> & {
    kind: "constructor" | "get" | "method" | "set" | "accessor" | "nonAccessor";
    accessorPair?: boolean;
    groupByDecorator?: string | boolean;
    sort?: "alphabetical" | "none";
    testName?: (s: string) => boolean;
    group?: string;
};

export type MemberInfo = Member & {
    node: TSESTree.ClassElement;

    // i don't remember what this does

    // TODO: this might make sense as a singular element
    acceptableSlots?: AcceptableSlot[];
    matchingAccessor?: string;
    isFirstAccessor?: boolean;
};

export type OrderItem = string | Partial<Order>;

export type Slots = Slots[] | Partial<Order>;

export type Slot = Exclude<OrderItem, string>;
export type Group = OrderItem | OrderItem[];

export type Groups = Record<string, Group>;

export type SortClassMembersConfig = {
    accessorPairPositioning: "getThenSet" | "setThenGet" | "together" | "any";
    groupPrivateWithAccessors: boolean;
    groups: Groups;
    locale: string;
    order: OrderItem[];
    sortInterfaces: boolean;
    stopAfterFirstProblem: boolean;
    reportType: "single" | "before" | "after" | "all";
    alphabetical: boolean;
};

export type MessageIds = "unorderedMember" | "unorderedClass" | "noClassExpression" | "accessorPair";

export type ProblemData = {
    source: MemberInfo;
    target: MemberInfo;
    expected: string;
};
