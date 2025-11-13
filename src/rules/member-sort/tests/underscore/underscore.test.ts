import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import { memberSort } from "../../main";
import { defaultOptions } from "../../options";

RuleTester.afterAll = afterAll;

RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            projectService: {
                allowDefaultProject: ["*.ts*"],
            },
            // tsconfigRootDir: "",
        },
    },
});

const invalid = {
    code: `
class MainClass extends BaseClass {
    protected debugging = false;

    private _bounds?: [number, number];
    private get bounds(): [number, number] {
        this._bounds ??= [0, 0];
        return this._bounds;
    }

    private _zIndex?: number;
    public get zIndex(): number {
        this._zIndex ??= 0;
        return this._zIndex;
    }
}`,

    fixed: [
        `
class MainClass extends BaseClass {
    protected debugging = false;

    private _zIndex?: number;

    private _bounds?: [number, number];
    private get bounds(): [number, number] {
        this._bounds ??= [0, 0];
        return this._bounds;
    }

    public get zIndex(): number {
        this._zIndex ??= 0;
        return this._zIndex;
    }
}`,
        `
class MainClass extends BaseClass {
    protected debugging = false;

    private _zIndex?: number;

    public get zIndex(): number {
        this._zIndex ??= 0;
        return this._zIndex;
    }

    private _bounds?: [number, number];
    private get bounds(): [number, number] {
        this._bounds ??= [0, 0];
        return this._bounds;
    }
}`,
    ],
};

const code = `
class MainClass extends BaseClass {
    protected debugging = false;

    private _zIndex?: number;
    public get zIndex(): number {
        this._zIndex ??= 0;
        return this._zIndex;
    }

    private _bounds?: [number, number];
    private get bounds(): [number, number] {
        this._bounds ??= [0, 0];
        return this._bounds;
    }
}`;

const classWithComments = {
    code: `
class A {
    private _b: number
    public get b(): number {}

    // comment
    private _a: number
}
`,
    fixed: [
        `
class A {
    // comment
    private _a: number

    private _b: number
    public get b(): number {}
}
`,
    ],
};

const classWithSandwichedComments = {
    code: `
class A {
    // comment1
    private _b: number
    public get b(): number {}
    // comment2
    private _a: number
}
`,
    fixed: [
        `
class A {
    // comment2
    private _a: number

    // comment1
    private _b: number
    public get b(): number {}
}
`,
    ],
};

const targetComments = {
    code: `
class A {

    // public foo: Foo;
    // private bar: Bar;

    private _b: number;
    private _a: number;
}
`,
    fixed: [
        `
class A {

    private _a: number;

    // public foo: Foo;
    // private bar: Bar;

    private _b: number;
}
`,
    ],
};

// the code and outputs are not nested here because it makes reading the class itself difficult
ruleTester.run("member-sort", memberSort, {
    invalid: [
        {
            code: invalid.code,
            errors: [
                {
                    data: {
                        expected: "before",
                        more: 7,
                        problem: "problems",
                        source: "property _zIndex",
                        target: "property _bounds",
                    },
                    messageId: "unorderedClass",
                },
            ],
            name: "override-alphabetical",
            options: [defaultOptions],
            output: invalid.fixed,
        },
        {
            code: invalid.code,
            errors: [
                {
                    data: {
                        expected: "before",
                        problem: "problems",
                        source: "property _zIndex",
                        target: "property _bounds",
                    },
                    messageId: "unorderedMember",
                },
                {
                    data: {
                        expected: "before",
                        problem: "problems",
                        source: "property _zIndex",
                        target: "getter bounds",
                    },
                    messageId: "unorderedMember",
                },
                {
                    data: {
                        expected: "before",
                        problem: "problems",
                        source: "getter zIndex",
                        target: "property _bounds",
                    },
                    messageId: "unorderedMember",
                },
                {
                    data: {
                        expected: "before",
                        problem: "problems",
                        source: "getter zIndex",
                        target: "getter bounds",
                    },
                    messageId: "unorderedMember",
                },
            ],
            name: "override-alphabetical",
            options: [{ ...defaultOptions, reportType: "before" }],
            output: invalid.fixed,
        },
        {
            code: classWithComments.code,
            errors: [
                {
                    data: {
                        expected: "before",
                        more: 3,
                        problem: "problems",
                        source: "property _a",
                        target: "property _b",
                    },
                    messageId: "unorderedClass",
                },
            ],
            name: "with-comments",
            options: [defaultOptions],
            output: classWithComments.fixed,
        },
        {
            code: classWithSandwichedComments.code,
            errors: [
                {
                    data: {
                        expected: "before",
                        more: 3,
                        problem: "problems",
                        source: "property _a",
                        target: "property _b",
                    },
                    messageId: "unorderedClass",
                },
            ],
            name: "sandwiched-comments",
            options: [defaultOptions],
            output: classWithSandwichedComments.fixed,
        },
        {
            code: targetComments.code,
            errors: [
                {
                    data: {
                        expected: "before",
                        more: 1,
                        problem: "problem",
                        source: "property _a",
                        target: "property _b",
                    },
                    messageId: "unorderedClass",
                },
            ],
            name: "target-with-comments",
            options: [defaultOptions],
            output: targetComments.fixed,
        },
        {
            code: targetComments.code,
            errors: [
                {
                    data: {
                        expected: "before",
                        problem: "problem",
                        source: "property _a",
                        target: "property _b",
                    },
                    messageId: "unorderedMember",
                },
            ],
            name: "target-with-comments-beforeOnly",
            options: [{ ...defaultOptions, reportType: "before" }],
            output: targetComments.fixed,
        },
    ],
    valid: [
        {
            code,
            options: [defaultOptions],
        },
    ],
});
