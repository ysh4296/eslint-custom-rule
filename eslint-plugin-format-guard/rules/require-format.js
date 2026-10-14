"use strict";

const { createExpressionChecker } = require("../utils/check-expression");
const { describeAllowedFormatters } = require("../utils/formatter");

// 화면에 텍스트로 보이는 HTML 속성. 컴포넌트 props(<Badge count={userCount} />)는 기본적으로 검사하지 않는다.
const DEFAULT_ATTRIBUTES = ["title", "alt", "aria-label", "placeholder"];

const nameList = {
  type: "array",
  items: { type: "string", minLength: 1 },
  uniqueItems: true,
};

function getAttributeName(attribute) {
  const { name } = attribute;
  return name.type === "JSXNamespacedName"
    ? `${name.namespace.name}:${name.name.name}`
    : name.name;
}

function toRegExp(pattern) {
  try {
    return new RegExp(pattern);
  } catch (error) {
    return null;
  }
}

/**
 * 옵션 정규화. 일반적인 설정 로딩(.eslintrc)에서는 meta.schema 가 먼저 잘못된 설정을 거부하지만,
 * Linter 를 직접 사용하는 등 스키마 검증을 거치지 않는 경우에도 예외 없이 동작하도록 방어한다.
 */
function normalizeRules(options) {
  const rules = options && Array.isArray(options.rules) ? options.rules : [];
  return rules
    .map((rule) => ({
      pattern: rule.pattern,
      regex: typeof rule.pattern === "string" ? toRegExp(rule.pattern) : null,
      functions: Array.isArray(rule.functions) ? rule.functions : [],
      methods: Array.isArray(rule.methods) ? rule.methods : [],
    }))
    .filter((rule) => rule.regex !== null);
}

function isRenderedContainer(container, attributes) {
  const { parent } = container;
  if (!parent) {
    return false;
  }
  if (parent.type === "JSXElement" || parent.type === "JSXFragment") {
    return true; // 자식 표현식 {...}
  }
  if (parent.type === "JSXAttribute") {
    return attributes.has(getAttributeName(parent));
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "require values whose names match configured patterns to be formatted before rendering in JSX",
      category: "Best Practices",
      recommended: false,
    },
    schema: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: [
        {
          type: "object",
          properties: {
            rules: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  pattern: { type: "string", minLength: 1, format: "regex" },
                  functions: nameList,
                  methods: nameList,
                },
                required: ["pattern"],
                additionalProperties: false,
              },
            },
            attributes: nameList,
          },
          required: ["rules"],
          additionalProperties: false,
        },
      ],
    },
    messages: {
      unformatted:
        "'{{name}}' 값은 포맷한 뒤 렌더링해야 합니다 (패턴: {{pattern}}, 허용: {{allowed}}).",
      invalidFormatter:
        "'{{name}}' 값에 허용되지 않은 포맷 '{{formatter}}'을(를) 사용했습니다 (패턴: {{pattern}}, 허용: {{allowed}}).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const rules = normalizeRules(options);
    if (rules.length === 0) {
      return {};
    }

    const attributes = new Set(
      Array.isArray(options.attributes) ? options.attributes : DEFAULT_ATTRIBUTES
    );
    const sourceCode = context.getSourceCode();
    const { checkExpression } = createExpressionChecker(rules);
    const reported = new WeakSet();

    function report({ node, rule, via }) {
      if (reported.has(node)) {
        return;
      }
      reported.add(node);

      context.report({
        node,
        messageId: via ? "invalidFormatter" : "unformatted",
        data: {
          name: sourceCode.getText(node),
          formatter: via || "",
          pattern: rule.pattern,
          allowed: describeAllowedFormatters(rule),
        },
      });
    }

    return {
      JSXExpressionContainer(node) {
        if (isRenderedContainer(node, attributes)) {
          checkExpression(node.expression).forEach(report);
        }
      },
    };
  },
};
