import eslintPluginTs from "@typescript-eslint/eslint-plugin";
import parserTs from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "vite.demo.config.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
        project: true,
      },
    },
    plugins: {
      "@typescript-eslint": eslintPluginTs,
      prettier: prettierPlugin,
    },
    rules: {
      ...eslintPluginTs.configs.recommended.rules,
      "prettier/prettier": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  prettierConfig,
];
