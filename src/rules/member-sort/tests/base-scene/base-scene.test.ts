import { RuleTester } from "@typescript-eslint/rule-tester";
import * as fs from "fs";
import { afterAll, describe, it } from "vitest";

import { phaserOptions } from "../../consts";
import { memberSort } from "../../main";

RuleTester.afterAll = afterAll;

RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const invalidClass: string = fs.readFileSync("src/rules/member-sort/tests/base-scene/invalid.ts", "utf-8");
const fixedClass1: string = fs.readFileSync("src/rules/member-sort/tests/base-scene/fixed1.ts", "utf-8");

const validClass: string = fs.readFileSync("src/rules/member-sort/tests/base-scene/valid.ts", "utf-8");

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            projectService: {
                allowDefaultProject: ["*.ts*"],
            },
        },
    },
});

ruleTester.run("member-sort", memberSort, {
    invalid: [
        {
            code: invalidClass,
            errors: [
                {
                    data: {
                        expected: "before",
                        more: 31,
                        problem: "problems",
                        source: "property _layers",
                        target: "getter config",
                    },
                    messageId: "unorderedClass",
                },
            ],
            name: "invalid",
            options: [phaserOptions],
            output: [fixedClass1],
            // TODO: setup this test
            skip: true,
        },
    ],
    valid: [
        {
            code: validClass,
            options: [phaserOptions],
        },
    ],
});
