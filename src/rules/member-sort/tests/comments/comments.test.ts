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
    
    // comments
    // second line
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

    // comments
    // second line
    public get zIndex(): number {
        this._zIndex ??= 0;
        return this._zIndex;
    }
}`,
        `
class MainClass extends BaseClass {
    protected debugging = false;

    private _zIndex?: number;

    // comments
    // second line
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
    ],
    valid: [
        {
            code: valid.code,
            options: [defaultOptions],
        },
    ],
});
