"use strict";

// `npm run playground` 로 실행. --rulesdir lib/rules 로 로컬 룰을 접두사 없이 불러온다.
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  rules: {
    "no-example-identifier": "error",
  },
};
