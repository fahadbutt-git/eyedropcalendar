import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["**/dist", "android", "ios", ".video", "brag-output", "public/sw.js"]),
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [reactHooks.configs["recommended-latest"], reactRefresh.configs.vite],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Build-time constants are set by scripts/extension.mjs.
    files: ["oscar/extension/src/**/*.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions, __EDT_SITE__: "readonly", __EDT_OSCARS__: "readonly" } },
  },
  {
    // Node scripts and tests. Browser suites also run code inside the
    // extension's service worker, which sees `chrome`.
    files: ["scripts/**", "tests/**", "oscar/standin/**", "oscar/tests/**", "*.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.webextensions } },
  },
]);
