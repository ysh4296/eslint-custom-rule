"use strict";

module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  extends: ["eslint:recommended", "plugin:eslint-plugin/recommended"],
  overrides: [
    {
      files: ["tests/**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: { sourceType: "module" },
      env: { mocha: true },
      rules: {
        // 식별자 존재 여부는 TypeScript(tsc) 가 검사한다
        "no-undef": "off",
      },
    },
  ],
};
