import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { tanstackConfig } from "@tanstack/eslint-config"

// Required packages
// "eslint": "^9.37.0",
// "globals": "^16.4.0",
// "typescript-eslint": "^8.46.0",

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
    {
        ignores: ["node_modules/"],
    },
    js.configs.recommended,
    ...tanstackConfig,
    {
        files: ["**/*.ts"],
        extends: [...tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            ecmaVersion: "latest",
            globals: {
                ...globals.node,
            },
            parserOptions: {
                project: true,
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/unbound-method": "off",
            // Tanstack Router specific
            "import/no-cycle": "off",
            "import/order": "off",
            "sort-imports": "off",
            "@typescript-eslint/array-type": "off",
            "@typescript-eslint/require-await": "off",
            "pnpm/json-enforce-catalog": "off",
        },
    },
)
