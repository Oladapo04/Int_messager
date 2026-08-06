const js = require("@eslint/js");
const globals = require("globals");

const safetyRules = {
  "no-undef": "error",
  "no-redeclare": "error",
  "no-unreachable": "error",
  "valid-typeof": "error",
  "no-dupe-keys": "error",
  "no-func-assign": "error",
  "no-import-assign": "error",

  // Existing legacy cleanup is visible but does not block validation.
  "no-unused-vars": ["warn", {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrorsIgnorePattern: "^_",
  }],
  "no-empty": ["warn", { allowEmptyCatch: true }],
  "no-constant-condition": "warn",
  "no-constant-binary-expression": "warn",
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "client/node_modules/**",
      "client/dist/**",
      "dist/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["server.js", "server/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: safetyRules,
  },
  {
    files: ["client/src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: safetyRules,
  },
];
