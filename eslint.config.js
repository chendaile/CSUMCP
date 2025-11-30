import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
        {
                ignores: ["dist-node/**", "node_modules/**", "third-party/**"],
        },
        js.configs.recommended,
        ...tseslint.configs.recommended.map((config) => ({
                ...config,
                files: ["**/*.ts", "**/*.tsx"],
                rules: {
                        ...config.rules,
                        "@typescript-eslint/no-explicit-any": "off",
                        "@typescript-eslint/no-unused-vars": [
                                "error",
                                {
                                        argsIgnorePattern: "^_",
                                        varsIgnorePattern: "^_",
                                },
                        ],
                        "no-control-regex": "off",
                },
        })),
];
