import { describe, expect, it } from "vitest";

import { determineNodeSeperator, getMemberDescription, getStringComparer, isAccessor } from "../helpers";

import { makeMember, makeNode } from "./helper";

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

describe("getStringComparer", () => {
    it("returns a function that always returns true when no argument is passed", () => {
        const compare = getStringComparer();
        expect(compare("anything")).toBe(true);
        expect(compare("")).toBe(true);
    });

    it("returns a strict equality comparer when given a normal string", () => {
        const compare = getStringComparer("test");
        expect(compare("test")).toBe(true);
        expect(compare("Test")).toBe(false);
        expect(compare("test1")).toBe(false);
    });

    describe("regex pattern handling", () => {
        it("treats strings starting with '/' as regex patterns", () => {
            const compare = getStringComparer("/abc/");
            expect(compare("abc")).toBe(true);
            expect(compare("abc123")).toBe(false); // because ^abc$ is enforced
        });

        it("adds missing ^ anchor automatically", () => {
            const compare = getStringComparer("/world/");
            expect(compare("world")).toBe(true);
            expect(compare("helloworld")).toBe(false);
        });

        it("adds missing $ anchor automatically", () => {
            const compare = getStringComparer("/hello/");
            expect(compare("hello")).toBe(true);
            expect(compare("hello1")).toBe(false);
        });

        it("does not duplicate ^ and $ if they already exist", () => {
            const compare = getStringComparer("/^foo$/");
            expect(compare("foo")).toBe(true);
            expect(compare("foo1")).toBe(false);
        });
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

describe("determineNodeSeperator", () => {
    it("returns space when tokens are on the same line", () => {
        const left = makeNode({ loc: { end: { column: 0, line: 1 }, start: { column: 0, line: 0 } } });
        const right = makeNode({ loc: { end: { column: 0, line: 1 }, start: { column: 0, line: 1 } } });

        expect(determineNodeSeperator(left, right)).toBe(" ");
    });

    it("returns newline when tokens are on different lines", () => {
        const left = makeNode({ loc: { end: { column: 0, line: 0 }, start: { column: 0, line: 0 } } });
        const right = makeNode({ loc: { end: { column: 0, line: 1 }, start: { column: 0, line: 1 } } });

        expect(determineNodeSeperator(left, right)).toBe("\n");
    });
});
