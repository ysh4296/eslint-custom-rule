"use strict";

// `yarn playground` 로 실행. --rulesdir lib/rules 로 로컬 룰을 접두사 없이 불러온다.
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  rules: {
    "no-korean-literal-in-jsx": "error",
  },
};
