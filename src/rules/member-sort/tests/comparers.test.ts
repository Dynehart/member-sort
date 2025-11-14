import { describe, expect, it } from "vitest";

import { comparers } from "../comparers";
import { getStringComparer, isAccessor } from "../helpers";

import { makeMember, makeSlot } from "./helper";

import type { Comparer } from "../types";

// vi.mock("../helpers", () => ({
//     getStringComparer: vi.fn(),
//     isAccessor: vi.fn(),
// }));

// Helper to find comparer by property
const byProp = (prop: string): Comparer => {
    const comparer = comparers.find((c) => c.property === prop);
    if (!comparer) throw new Error();

    return comparer;
};

describe("comparers", () => {
    // =========================================================================
    // Basic equality comparers
    // =========================================================================

    it("type comparer", () => {
        const comparer = byProp("type");
        const m = makeMember({ type: "method" });
        const s = makeSlot({ type: "method" });

        expect(comparer.test(m, s)).toBe(true);
    });

    it("static comparer", () => {
        const comparer = byProp("static");
        expect(comparer.test(makeMember({ static: true }), makeSlot({ static: true }))).toBe(true);
    });

    it("private comparer", () => {
        const comparer = byProp("private");
        expect(comparer.test(makeMember({ private: true }), makeSlot({ private: true }))).toBe(true);
    });

    it("accessibility comparer", () => {
        const comparer = byProp("accessibility");
        expect(comparer.test(makeMember({ accessibility: "public" }), makeSlot({ accessibility: "public" }))).toBe(
            true,
        );
    });

    it("abstract comparer", () => {
        const comparer = byProp("abstract");
        expect(comparer.test(makeMember({ abstract: true }), makeSlot({ abstract: true }))).toBe(true);
    });

    it("override comparer", () => {
        const comparer = byProp("override");
        expect(comparer.test(makeMember({ override: true }), makeSlot({ override: true }))).toBe(true);
    });

    it("readonly comparer", () => {
        const comparer = byProp("readonly");
        expect(comparer.test(makeMember({ readonly: true }), makeSlot({ readonly: true }))).toBe(true);
    });

    it("async comparer", () => {
        const comparer = byProp("async");
        expect(comparer.test(makeMember({ async: true }), makeSlot({ async: true }))).toBe(true);
    });

    // =========================================================================
    // Kind comparer
    // =========================================================================

    describe("kind comparer", () => {
        const comparer = byProp("kind");

        it("slot.kind: accessor → true when isAccessor(member) === true", () => {
            const m = makeMember({ kind: "get" }); // real isAccessor() sees "get"
            const s = makeSlot({ kind: "accessor" });
            expect(isAccessor(m)).toBe(true);
            expect(comparer.test(m, s)).toBe(true);
        });

        it("slot.kind: accessor → false when isAccessor(member) === false", () => {
            const m = makeMember({ kind: "method" });
            const s = makeSlot({ kind: "accessor" });
            expect(isAccessor(m)).toBe(false);
            expect(comparer.test(m, s)).toBe(false);
        });

        it("slot.kind: nonAccessor → true when !isAccessor(member)", () => {
            const m = makeMember({ kind: "method" });
            const s = makeSlot({ kind: "nonAccessor" });
            expect(comparer.test(m, s)).toBe(true);
        });

        it("direct kind equality", () => {
            const m = makeMember({ kind: "method" });
            const s = makeSlot({ kind: "method" });
            expect(comparer.test(m, s)).toBe(true);
        });
    });

    // =========================================================================
    // groupByDecorator comparer
    // =========================================================================

    describe("groupByDecorator comparer", () => {
        const comparer = byProp("groupByDecorator");

        it("returns false when slot.groupByDecorator is undefined", () => {
            const m = makeMember({ decorators: ["Something"] });
            const s = makeSlot({ groupByDecorator: undefined });
            expect(comparer.test(m, s)).toBe(false);
        });

        it("boolean=true matches when member has decorators", () => {
            const m = makeMember({ decorators: ["Dec"] });
            const s = makeSlot({ groupByDecorator: true });
            expect(comparer.test(m, s)).toBe(true);
        });

        it("boolean=false matches when member has no decorators", () => {
            const m = makeMember({ decorators: [] });
            const s = makeSlot({ groupByDecorator: false });
            expect(comparer.test(m, s)).toBe(true);
        });

        it("string comparer: matches when any decorator passes getStringComparer()", () => {
            const matchFn = getStringComparer("Inject");
            expect(matchFn("Inject")).toBe(true);

            const m = makeMember({ decorators: ["Inject", "Other"] });
            const s = makeSlot({ groupByDecorator: "Inject" });
            expect(comparer.test(m, s)).toBe(true);
        });
    });

    // =========================================================================
    // accessorPair comparer
    // =========================================================================

    it("accessorPair comparer matches when accessor + matchingAccessor exists", () => {
        const member = makeMember({ kind: "get", matchingAccessor: "foo" });
        expect(isAccessor(member)).toBe(true);

        const comparer = byProp("accessorPair");
        expect(comparer.test(member, makeSlot({}))).toBe(true);
    });

    it("accessorPair comparer false when non-accessor", () => {
        const member = makeMember({ kind: "method", matchingAccessor: "foo" });
        const comparer = byProp("accessorPair");

        expect(isAccessor(member)).toBe(false);
        expect(comparer.test(member, makeSlot({}))).toBe(false);
    });

    it("accessorPair comparer false when no matchingAccessor", () => {
        const member = makeMember({ kind: "get", matchingAccessor: undefined });
        const comparer = byProp("accessorPair");

        expect(isAccessor(member)).toBe(true);
        expect(comparer.test(member, makeSlot({}))).toBe(false);
    });

    it("name comparer uses slot.testName", () => {
        const comparer = byProp("name");

        const member = makeMember({ name: "MyProp" });
        const slot = makeSlot({
            testName: (n) => n.startsWith("My"),
        });

        expect(comparer.test(member, slot)).toBe(true);
    });
});
