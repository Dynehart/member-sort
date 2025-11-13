import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import { memberSort } from "../main";
import { defaultOptions } from "../options";

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

    #bounds?: [number, number];
    private get bounds(): [number, number] {
        this.#bounds ??= [0, 0];
        return this.#bounds;
    }

    #zIndex?: number;
    public get zIndex(): number {
        this.#zIndex ??= 0;
        return this.#zIndex;
    }
}`,

    fixed: [
        `
class MainClass extends BaseClass {
    protected debugging = false;

    #zIndex?: number;

    #bounds?: [number, number];
    private get bounds(): [number, number] {
        this.#bounds ??= [0, 0];
        return this.#bounds;
    }

    public get zIndex(): number {
        this.#zIndex ??= 0;
        return this.#zIndex;
    }
}`,
        `
class MainClass extends BaseClass {
    protected debugging = false;

    #zIndex?: number;

    public get zIndex(): number {
        this.#zIndex ??= 0;
        return this.#zIndex;
    }

    #bounds?: [number, number];
    private get bounds(): [number, number] {
        this.#bounds ??= [0, 0];
        return this.#bounds;
    }
}`,
    ],
};

const code = `
class MainClass extends BaseClass {
    protected debugging = false;

    #zIndex?: number;
    public get zIndex(): number {
        this.#zIndex ??= 0;
        return this.#zIndex;
    }

    #bounds?: [number, number];
    private get bounds(): [number, number] {
        this.#bounds ??= [0, 0];
        return this.#bounds;
    }
}`;

const classWithComments = {
    code: `
class A {
    #b: number
    public get b(): number {}

    // comment
    #a: number
}
`,
    fixed: [
        `
class A {
    // comment
    #a: number

    #b: number
    public get b(): number {}
}
`,
    ],
};

const classWithSandwichedComments = {
    code: `
class A {
    // comment1
    #b: number
    public get b(): number {}
    // comment2
    #a: number
}
`,
    fixed: [
        `
class A {
    // comment2
    #a: number

    // comment1
    #b: number
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

    private b: number;
    private a: number;
}
`,
    fixed: [
        `
class A {

    private a: number;

    // public foo: Foo;
    // private bar: Bar;

    private b: number;
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
                        source: "property zIndex",
                        target: "property bounds",
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
                        source: "property zIndex",
                        target: "property bounds",
                    },
                    messageId: "unorderedMember",
                },
                {
                    data: {
                        expected: "before",
                        problem: "problems",
                        source: "property zIndex",
                        target: "getter bounds",
                    },
                    messageId: "unorderedMember",
                },
                {
                    data: {
                        expected: "before",
                        problem: "problems",
                        source: "getter zIndex",
                        target: "property bounds",
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
                        source: "property a",
                        target: "property b",
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
                        source: "property a",
                        target: "property b",
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
                        source: "property a",
                        target: "property b",
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
                        source: "property a",
                        target: "property b",
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
