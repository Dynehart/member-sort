import { RuleTester } from "@typescript-eslint/rule-tester";
import * as fs from "fs";
import { afterAll, describe, it } from "vitest";

import { memberSort } from "../main";
import { defaultOptions } from "../options";

RuleTester.afterAll = afterAll;

RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

// these really slow things down but it makes debugging so much easier

const validClassA: string = fs.readFileSync("src/rules/member-sort/tests/validA.ts", "utf-8");
const invalidClassA: string = fs.readFileSync("src/rules/member-sort/tests/invalidA.ts", "utf-8");
const fixedClassA1: string = fs.readFileSync("src/rules/member-sort/tests/fixedA1.ts", "utf-8");
const fixedClassA2: string = fs.readFileSync("src/rules/member-sort/tests/fixedA2.ts", "utf-8");

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

// the code and outputs are not nested here because it makes reading the class itself difficult
ruleTester.run("member-sort", memberSort, {
    invalid: [
        {
            code: invalidClassA,
            errors: [
                {
                    data: {
                        expected: "before",
                        more: 7,
                        problem: "problems",
                        source: "property a",
                        target: "property b",
                    },
                    messageId: "unorderedClass",
                },
            ],
            name: "test-da-class-file",
            options: [defaultOptions],
            output: [fixedClassA1, fixedClassA2],
        },
    ],
    valid: [
        {
            code: validClassA,
            options: [defaultOptions],
        },
    ],
});
