import { getStringComparer } from "./getStringComparer";

import type { Group, Groups, OrderItem, Slot, Slots, SortClassMembersConfig } from "../types";

export const getExpectedOrder = ({ groups, order }: SortClassMembersConfig): Slot[] =>
    flatten<Slot>(order.map((s) => flat(expandSlot(s, groups))));

// this feels bad
const flat = (slots: Slots[]): Slot[] =>
    flatten<Slot>(
        slots.map((slot) => {
            if (Array.isArray(slot)) {
                return flat(slot);
            }
            return slot;
        }),
    );

const expandSlot = (input: Group, groups: Groups): Slots[] => {
    if (Array.isArray(input)) return input.map((x: OrderItem) => expandSlot(x, groups));

    let slot: Slot;
    if (typeof input === "string" && input.startsWith("[")) {
        // extracts group name
        slot = { group: input.substring(1, input.length - 1) };
    } else if (typeof input === "string") {
        // this is for an exact match like "init"
        slot = { name: input };
    } else {
        slot = { ...input };
    }

    if (slot.group === undefined) {
        slot.testName = getStringComparer(slot.name);

        return [slot];
    }

    if (Object.prototype.hasOwnProperty.call(groups, slot.group)) {
        const group = groups[slot.group];
        if (group === undefined) return [];

        return expandSlot(group, groups);
    }
    return [];
};

const flatten = <T>(collection: (T | T[])[]): T[] => {
    const result = [];
    for (const item of collection) {
        if (Array.isArray(item)) result.push(...flatten(item));
        else result.push(item);
    }
    return result;
};
