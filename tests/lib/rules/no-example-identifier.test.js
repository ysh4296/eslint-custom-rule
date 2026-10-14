"use strict";

const { RuleTester } = require("eslint");
const rule = require("../../../lib/rules/no-example-identifier");

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: "module" },
});

ruleTester.run("no-example-identifier", rule, {
  valid: ["const foo = 1;", "function bar() {}"],
  invalid: [
    {
      code: "const example = 1;",
      errors: [{ messageId: "noExample" }],
    },
    {
      code: "example();",
      errors: [{ messageId: "noExample" }],
    },
  ],
});
