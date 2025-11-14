import { describe, expect, it } from "vitest";

import { defaultOptions } from "../options";
import { makeMember } from "../tests";

import { findAccessorPairProblems, findProblems } from "./findProblems";

import type { AcceptableSlot } from "../types";

describe("findAccessorPairProblems", () => {
    it("returns empty when accessorPairPositioning === 'any'", () => {
        const members = [
            makeMember({ id: "a", kind: "get", matchingAccessor: "b" }),
            makeMember({ id: "b", kind: "set" }),
        ];

        const result = findAccessorPairProblems(members, { ...defaultOptions, accessorPairPositioning: "any" });

        expect(result).toEqual([]);
    });

    it("reports problem when getter-setter are reversed (expect get then set)", () => {
        const getter = makeMember({ id: "getId", kind: "get", matchingAccessor: "setId" });
        const setter = makeMember({ id: "setId", kind: "set", matchingAccessor: "getId" });

        // reversed intentionally
        const members = [setter, getter];
        const result = findAccessorPairProblems(members, defaultOptions);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            expected: "before",
            source: getter,
            target: setter,
        });
    });

    it("reports problem when pair is correct but not adjacent", () => {
        const getter = makeMember({ id: "getId", kind: "get", matchingAccessor: "setId" });
        const middle = makeMember({ id: "middle" });
        const setter = makeMember({ id: "setId", kind: "set", matchingAccessor: "getId" });

        const members = [getter, middle, setter];

        const result = findAccessorPairProblems(members, defaultOptions);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            expected: "after",
            source: setter,
            target: getter,
        });
    });

    it("correctly accepts adjacent accessor pair", () => {
        const getter = makeMember({ id: "getId", kind: "get", matchingAccessor: "setId" });
        const setter = makeMember({ id: "setId", kind: "set", matchingAccessor: "getId" });

        const members = [getter, setter];
        const result = findAccessorPairProblems(members, defaultOptions);

        expect(result).toEqual([]);
    });

    it("supports setThenGet ordering", () => {
        const getter = makeMember({ id: "getId", kind: "get", matchingAccessor: "setId" });
        const setter = makeMember({ id: "setId", kind: "set", matchingAccessor: "getId" });

        const members = [getter, setter];

        const result = findAccessorPairProblems(members, {
            ...defaultOptions,
            accessorPairPositioning: "setThenGet",
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            expected: "before",
            source: setter,
            target: getter,
        });
    });
});

const slot = (index: number, score: number, sort: "alphabetical" | "none" = "none"): AcceptableSlot => ({
    index,
    score,
    sort,
});

describe("findProblems (with real areMembersInCorrectOrder)", () => {
    it("returns empty when order is correct based on acceptableSlots.index", () => {
        const m1 = makeMember({
            acceptableSlots: [slot(0, 0)],
            name: "A",
        });
        const m2 = makeMember({
            acceptableSlots: [slot(1, 0)],
            name: "B",
        });

        const result = findProblems([m1, m2], { ...defaultOptions, alphabetical: false });

        expect(result).toEqual([]);
    });

    it("reports incorrect order when acceptableSlots.index is reversed", () => {
        const m1 = makeMember({
            acceptableSlots: [slot(1, 0)],
            name: "A",
        });
        const m2 = makeMember({
            acceptableSlots: [slot(0, 0)],
            name: "B",
        });

        const result = findProblems([m1, m2], { ...defaultOptions, alphabetical: false });

        // We expect both 'before' and 'after'
        expect(result).toHaveLength(2);

        expect(result).toContainEqual({
            expected: "before",
            source: m2,
            target: m1,
        });

        expect(result).toContainEqual({
            expected: "after",
            source: m1,
            target: m2,
        });
    });

    it("reports after problems", () => {
        const m1 = makeMember({
            acceptableSlots: [slot(1, 0)],
            name: "A",
        });
        const m2 = makeMember({
            acceptableSlots: [slot(0, 0)],
            name: "B",
        });
        const result = findProblems([m1, m2], { ...defaultOptions, alphabetical: false, reportType: "after" });

        expect(result).toHaveLength(1);

        expect(result).toContainEqual({
            expected: "after",
            source: m1,
            target: m2,
        });
    });

    it("uses alphabetical ordering when indexes and scores match and alphabetical mode enabled", () => {
        const m1 = makeMember({
            acceptableSlots: [slot(0, 0, "alphabetical")],
            name: "Beta",
        });

        const m2 = makeMember({
            acceptableSlots: [slot(0, 0, "alphabetical")],
            name: "Alpha",
        });

        // alphabetical: true -> should enforce name order
        const result = findProblems([m1, m2], defaultOptions);

        expect(result).toHaveLength(2);

        expect(result).toContainEqual({
            expected: "before",
            source: m2,
            target: m1,
        });

        expect(result).toContainEqual({
            expected: "after",
            source: m1,
            target: m2,
        });
    });

    it("does NOT enforce alphabetical order when alphabetical=false and slots are not alphabetical", () => {
        const m1 = makeMember({
            acceptableSlots: [slot(0, 0, "none")],
            name: "Beta",
        });

        const m2 = makeMember({
            acceptableSlots: [slot(0, 0, "none")],
            name: "Alpha",
        });

        const result = findProblems([m1, m2], { ...defaultOptions, alphabetical: false });

        // acceptableSlots.index and score both match
        // alphabetical is disabled
        // -> returns correct by default
        expect(result).toEqual([]);
    });

    it("treats undefined acceptableSlots on first as incorrect order (first.acceptableSlots undefined)", () => {
        const m1 = makeMember({
            acceptableSlots: undefined,
            name: "A",
        });

        const m2 = makeMember({
            acceptableSlots: [slot(0, 0)],
            name: "B",
        });

        const result = findProblems([m1, m2], { ...defaultOptions, alphabetical: false });

        // should always be incorrect
        expect(result).toHaveLength(2);
    });

    it("treats undefined acceptableSlots on second as always acceptable (first has them)", () => {
        const m1 = makeMember({
            acceptableSlots: [slot(0, 0)],
            name: "A",
        });

        const m2 = makeMember({
            acceptableSlots: undefined,
            name: "B",
        });

        // expected behavior: acceptable because second has no constraints
        const result = findProblems([m1, m2], { ...defaultOptions, alphabetical: false });

        expect(result).toEqual([]);
    });
});
