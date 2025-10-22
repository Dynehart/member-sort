import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sort from "eslint-plugin-sort";
import path from "path";
import tseslint from "typescript-eslint";

/**
 * rules should be ordered alphabetically for easier navigation
 */

const rules = {
    "arrow-body-style": ["error", "as-needed"], // TODO: determine if default of "as-needed" is apprpriate

    "curly": ["error", "multi-line"],
    "eqeqeq": ["error"],
    // func style and arrow-body-style should combine to force declared arrow functions
    "func-style": ["error", "expression", { allowArrowFunctions: true }],

    "no-console": ["warn"],
    "no-constant-binary-expression": ["error"],

    // TODO: idk if this is what would unclear || expressions
    "no-restricted-syntax": [
        "error",
        {
            message: "Prefer named exports",
            selector: "ExportDefaultDeclaration",
        },
    ],

    "prefer-arrow-callback": ["error"],
    "sort/exports": ["off"], // handled by import
    "sort/exports-members": ["off"], // handled by import

    "sort/import-members": ["off"], // handled by import
    "sort/imports": ["off"],

    // https://github.com/mskelton/eslint-plugin-sort
    // TODO: remove eslint-plugin-typescript-sort-keys
    "sort-keys": ["error", "asc", { allowLineSeparatedGroups: true, caseSensitive: true, natural: false }],
};

const typescriptRules = {
    "@typescript-eslint/consistent-type-definitions": ["error", "type"],

    "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { accessibility: "explicit", ignoredMethodNames: ["constructor"] },
    ],

    "@typescript-eslint/explicit-module-boundary-types": "error",
    "@typescript-eslint/no-inferrable-types": ["error", { ignoreParameters: true, ignoreProperties: true }],
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-shadow": "error",

    // this one is dumb. explicit checks are easier to read. e.g.
    // if (!("coin" in save))
    // if ("coin" in save === false)
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",

    // allowed
    //     const isUpgradeId = (key: string): key is UpgradeId => (UPGRADE_IDS as readonly string[]).includes(key);
    // not allowed
    //     const isUpgradeId = (key: string): key is UpgradeId => UPGRADE_IDS.includes(key as UpgradeId);
    // TODO: how is this not on by default? Super important rule
    "@typescript-eslint/no-unsafe-type-assertion": ["error"],

    // might not want to have this but since there's a lot of class extension
    // e.g. Scene.update(time: number, delta: number)
    // we'll keep it so we can more easily know what's available
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

    // https://typescript-eslint.io/rules/no-useless-empty-export/
    "@typescript-eslint/no-useless-empty-export": "error",

    // is a problem with noUncheckedIndex. e.g.
    // if (!this.nodes[0]) {
    //     this.nodes[0] = this.createNode();
    // }
    // this is an annoying fucking rule. we can disable it with ecmaVersion
    // https://typescript-eslint.io/rules/prefer-nullish-coalescing/
    // we just have to bypass assignments with an intermediary step
    "@typescript-eslint/prefer-nullish-coalescing": ["error"],

    // diff is: allowNumber: true
    "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
            allowAny: false,
            allowBoolean: false,
            allowNever: false,
            allowNullish: false,
            allowNumber: true,
            allowRegExp: false,
        },
    ],

    // https://typescript-eslint.io/rules/strict-boolean-expressions/
    "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
            allowAny: false,
            allowNullableBoolean: false,
            allowNullableEnum: false,
            allowNullableNumber: false,
            allowNullableObject: true,
            allowNullableString: false,
            allowNumber: false, // TODO: how the fuck is this not part of the strict set of rules?
            allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false,
            allowString: true,
        },
    ],
    "no-shadow": "off", // TODO: wtf why is this off by default as well?
};

const importRules = {
    "import/default": "off",

    "import/first": "error",

    "import/newline-after-import": "error",
    "import/no-default-export": "error",
    "import/no-duplicates": "error",

    "import/no-internal-modules": [
        "error",
        {
            // could do just "@typescript-eslint/utils/*"
            allow: [
                "@typescript-eslint/utils",
                "@typescript-eslint/utils/ts-eslint",
                "@typescript-eslint/utils/json-schema",
            ],
        },
    ],
    // forces importing named members instead of using them as part of the default
    // e.g. React.useEffect would error since you can import useEffect
    "import/no-named-as-default-member": "error",
    // (\.{2}\/)(.{2})+[^\/]$
    // "import/no-restricted-paths": [
    //     "error",
    //     {
    //         zones: [
    //             {
    //                 target: "./",
    //                 from: "../",
    //                 except: ["../index"],
    //             },
    //         ],
    //     },
    // ],

    // TODO: very annoying how inconsistently it works and how it flags the entire exported object as an error
    "import/no-unused-modules": [
        "off",
        {
            src: ["./src/**/*.ts"],
            unusedExports: true,
        },
    ],
    "import/order": "off",

    "simple-import-sort/exports": "error",
    "simple-import-sort/imports": [
        "error",
        {
            groups: [
                ["^\\u0000"],
                ["^node:"],
                ["^@?\\w"],
                ["^"],

                // Relative imports. Anything that starts with a dot.
                ["^(\\.\\.)"], // parent
                ["^\\."], // sibling

                ["^.+\\u0000$"],
            ],
        },
    ],
    // "import/no-unassigned-import": ["error"],
    // "import/order": [
    //     "error",
    //     {
    //         // "distinctGroup": false,
    //         "newlines-between": "always",
    //         "groups": [
    //             ["builtin", "external"],
    //             ["sibling", "parent"],
    //             "index",
    //             "sibling",
    //             "object",
    //         ],
    //     },
    // ],
};

export const config = defineConfig(
    eslint.configs.recommended,

    importPlugin.flatConfigs.recommended,

    // // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/eslintrc/strict-type-checked.ts
    tseslint.configs.strictTypeChecked,

    // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/eslintrc/stylistic-type-checked.ts
    tseslint.configs.stylisticTypeChecked,

    eslintConfigPrettier,

    sort.configs["flat/recommended"],
    // sortClassMembers.configs["flat/recommended"],

    {
        extends: [importPlugin.flatConfigs.recommended, importPlugin.flatConfigs.typescript],
        files: ["**/*.{ts,tsx,mts,cts}", "*.ts"],
        languageOptions: {
            // this is just to get prefer-nullish-coalescing to behave since nullish-assignments are a 2021 feature
            ecmaVersion: 2020,
            parser: tseslint.parser,

            parserOptions: {
                project: "./tsconfig.json",
                sourceType: "module",
                tsconfigRootDir: path.resolve(),
            },
        },
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            ...typescriptRules,
            ...importRules,
            ...rules,
        },
        settings: {
            "import/resolver": {
                typescript: {
                    project: "./tsconfig.json",
                },
            },
        },
    },

    // "node": true

    // attempt to fix `p lint .` but not necessary when linting using `p lint src/**`
    // You have used a rule which requires type information, but don't have parserOptions set to generate type information for this file.
    {
        files: ["**/*.{js,mjs,cjs,jsx}"],
        languageOptions: {
            parser: tseslint.parser,
        },
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            ...tseslint.configs.disableTypeChecked.rules,
        },
    },

    {
        files: ["eslint.config.mjs"],
        languageOptions: {
            parser: tseslint.parser,
        },
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            ...tseslint.configs.disableTypeChecked.rules,
            "sort-keys": ["error", "asc", { allowLineSeparatedGroups: false, caseSensitive: false, natural: true }],
        },
        settings: {
            "import/resolver": {
                node: {
                    extensions: [".js", ".jsx", ".ts", ".tsx"],
                },
                typescript: {
                    project: "./tsconfig.json",
                },
            },
        },
    },

    {
        ignores: ["dist/*", "tsdown.config.ts"],
    },
);

// config.settings = {
//     "import/core-modules": [
//         // mark these as "virtual" core modules so no-unresolved won't flag them
//         "eslint/config",
//         "typescript-eslint",
//         "eslint-plugin-sort",
//     ],
// };

export default config;
