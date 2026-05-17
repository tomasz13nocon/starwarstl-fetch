import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/*", "!src/", "!src/**"]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  // tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.es2021,
        ...globals.node,
      },
    },
    rules: {
      // "no-unused-vars": [
      //   "warn",
      //   {
      //     argsIgnorePattern: "^_",
      //     varsIgnorePattern: "^_",
      //     caughtErrorsIgnorePattern: "^_",
      //   },
      // ],
      "require-await": "error",
      "prefer-const": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  prettier,
);
