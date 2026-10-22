import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs["flat/recommended"],
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["astro.config.{js,mjs,cjs}", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    ...eslintPluginReact.configs.flat.recommended,
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: { "react-hooks": eslintPluginReactHooks },
    rules: eslintPluginReactHooks.configs.recommended.rules,
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  eslintConfigPrettier,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".astro/**",
      // Worktrees de session (gitignorés) : la gate ne dépend pas de l'état du poste.
      ".worktrees/**",
    ],
  },
);
