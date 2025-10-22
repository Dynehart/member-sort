import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import { defaultOptions } from "./consts";
import { memberSort } from "./main";

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

const invalid = `
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

    }`;

const fixed1 = `
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

    }`;

const fixed2 = `
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

ruleTester.run("my-rule", memberSort, {
    invalid: [
        {
            code: invalid,
            errors: [
                {
                    data: {
                        expected: "before",
                        // wtf where does this come from?
                        more: 7,
                        problem: "problems",
                        source: "property zIndex",
                        target: "property bounds",
                    },
                    messageId: "unorderedClass",
                },
            ],
            options: [defaultOptions],
            output: [fixed1, fixed2],
        },
    ],
    valid: [
        {
            code,
            options: [defaultOptions],
        },
    ],
});
