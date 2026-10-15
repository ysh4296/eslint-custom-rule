"use strict";

const {
  resolveNamePattern,
  getZustandImports,
  isStoreCreateCall,
} = require("../utils/zustand");

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "enforce a naming pattern for Zustand store hooks created with create()",
      category: "Stylistic Issues",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          pattern: { type: "string", minLength: 1, format: "regex" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidName: "Zustand 스토어 훅 '{{name}}' 의 이름은 패턴 {{pattern}} 과(와) 일치해야 합니다.",
    },
  },

  create(context) {
    const { pattern, regex } = resolveNamePattern((context.options[0] || {}).pattern);
    let createCallees = new Set();

    return {
      Program() {
        createCallees = getZustandImports(context).createCallees;
      },
      VariableDeclarator(node) {
        if (
          createCallees.size === 0 ||
          node.id.type !== "Identifier" ||
          !isStoreCreateCall(node.init, createCallees)
        ) {
          return;
        }
        if (!regex.test(node.id.name)) {
          context.report({
            node: node.id,
            messageId: "invalidName",
            data: { name: node.id.name, pattern },
          });
        }
      },
    };
  },
};
