import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import { defaultOptions } from "../../consts";
import { memberSort } from "../../main";

import type { MessageIds, SortClassMembersConfig } from "../../types";
import type { InvalidTestCase } from "@typescript-eslint/rule-tester";

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

type TestCase = {
    code: string;
    errors: {
        data: { expected: string; more: number; problem: string; source: string; target: string };
        messageId: MessageIds;
    }[];
    output: string[];
    name: string;
    options?: SortClassMembersConfig;
};

const invalid: TestCase[] = [];

const staticGetter: TestCase = {
    code: `
class MainClass extends BaseClass {
    private static _alpha?: boolean;

    private static beta = true;

    public static get alpha(): boolean {
        SceneInput._alpha ??= false;
        return SceneInput._alpha;
    }
}`,
    errors: [
        {
            data: {
                expected: "before",
                more: 1,
                problem: "problem",
                source: "static property beta",
                target: "static property _alpha",
            },
            messageId: "unorderedClass",
        },
    ],

    name: "static-getter",

    output: [
        `
class MainClass extends BaseClass {
    private static beta = true;

    private static _alpha?: boolean;

    public static get alpha(): boolean {
        SceneInput._alpha ??= false;
        return SceneInput._alpha;
    }
}`,
    ],
};
invalid.push(staticGetter);

const staticAccess: TestCase = {
    code: `
class MainClass extends BaseClass {
    private static _alpha?: boolean;

    public static beta = true;
}`,

    errors: [
        {
            data: {
                expected: "before",
                more: 1,
                problem: "problem",
                source: "static property beta",
                target: "static property _alpha",
            },
            messageId: "unorderedClass",
        },
    ],

    name: "static-access",

    output: [
        `
class MainClass extends BaseClass {
    public static beta = true;

    private static _alpha?: boolean;
}`,
    ],
};
invalid.push(staticAccess);

const access: TestCase = {
    code: `
class MainClass extends BaseClass {
    private _alpha?: boolean;

    public beta = true;
}`,

    errors: [
        {
            data: {
                expected: "before",
                more: 1,
                problem: "problem",
                source: "property beta",
                target: "property _alpha",
            },
            messageId: "unorderedClass",
        },
    ],

    name: "access",

    output: [
        `
class MainClass extends BaseClass {
    public beta = true;

    private _alpha?: boolean;
}`,
    ],
};
invalid.push(access);

const valid = {
    code: `
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
};

ruleTester.run("member-sort", memberSort, {
    invalid: invalid.map(
        ({ code, errors, name, options, output }): InvalidTestCase<MessageIds, [SortClassMembersConfig]> => ({
            code,
            errors,
            name,
            options: [{ ...defaultOptions, ...options }],
            output,
        }),
    ),
    valid: [
        {
            code: valid.code,
            options: [defaultOptions],
        },
    ],
});
