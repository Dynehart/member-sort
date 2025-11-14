import { describe, expect, it } from "vitest";

import { getMemberDescription, isAccessor } from "../helpers";

import { makeMember } from "./helper";

describe("getMemberDescription", () => {
    it("returns 'constructor' for constructor kind", () => {
        const member = makeMember({ kind: "constructor" });
        expect(getMemberDescription(member, {})).toBe("constructor");
    });

    it("returns type when kind is null", () => {
        const member = makeMember({
            kind: null,
            type: "method",
        });

        expect(getMemberDescription(member, {})).toBe("method foo");
    });

    it("handles getters", () => {
        const member = makeMember({
            kind: "get",
            name: "value",
        });

        expect(getMemberDescription(member, {})).toBe("getter value");
    });

    it("handles setters", () => {
        const member = makeMember({
            kind: "set",
            name: "value",
        });

        expect(getMemberDescription(member, {})).toBe("setter value");
    });

    it("handles accessor pair when groupAccessors = true", () => {
        const member = makeMember({
            kind: "get",
            matchingAccessor: "value",
            name: "value",
        });

        expect(getMemberDescription(member, { groupAccessors: true })).toBe("accessor pair value");
    });

    it("does NOT group accessors when groupAccessors = false", () => {
        const member = makeMember({
            kind: "get",
            matchingAccessor: "value",
            name: "value",
        });

        expect(getMemberDescription(member, { groupAccessors: false })).toBe("getter value");
    });

    it("includes 'static' prefix when static is true", () => {
        const member = makeMember({
            kind: null,
            name: "bar",
            static: true,
            type: "method",
        });

        expect(getMemberDescription(member, {})).toBe("static method bar");
    });

    it("falls back to type when not accessor or special case", () => {
        const member = makeMember({
            kind: "method",
            name: "doThing",
            type: "method",
        });

        expect(getMemberDescription(member, {})).toBe("method doThing");
    });
});

describe("isAccessor", () => {
    it("returns true for {kind: 'get'}", () => {
        const member = makeMember({ kind: "get" });
        expect(isAccessor(member)).toBe(true);
    });

    it("returns true for {kind: 'set'}", () => {
        const member = makeMember({ kind: "set" });
        expect(isAccessor(member)).toBe(true);
    });

    it("returns true for {kind: 'get'}", () => {
        const member = makeMember({ kind: "get", matchingAccessor: undefined });
        expect(isAccessor(member)).toBe(true);
    });

    it("returns false for {kind: undefined}", () => {
        const member = makeMember({ kind: undefined });
        expect(isAccessor(member)).toBe(false);
    });

    it("returns false for non-accessor kinds like 'method'", () => {
        const member = makeMember({ kind: "method" });
        expect(isAccessor(member)).toBe(false);
    });

    it("returns false for constructor", () => {
        const member = makeMember({ kind: "constructor" });
        expect(isAccessor(member)).toBe(false);
    });
});
