"use strict";

const KOREAN_SYLLABLE = /[가-힣]/;

// 값을 그대로 감싸기만 하는 래퍼 노드 (TypeScript / Flow). 내부 expression 을 그대로 렌더링한다.
const TRANSPARENT_WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TypeCastExpression",
  "ChainExpression",
]);

function hasKorean(text) {
  return typeof text === "string" && KOREAN_SYLLABLE.test(text);
}

function getAttributeName(attribute) {
  const { name } = attribute;
  return name.type === "JSXNamespacedName"
    ? `${name.namespace.name}:${name.name.name}`
    : name.name;
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "disallow hard-coded Korean string literals rendered in JSX (use i18n translation functions)",
      category: "Best Practices",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          ignoreAttributes: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noKoreanLiteral:
        "JSX 내부에 한글 문자열을 직접 작성할 수 없습니다. i18n 번역 함수를 사용하세요.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const ignoreAttributes = new Set(options.ignoreAttributes || []);
    const sourceCode = context.getSourceCode();

    function report(node, loc) {
      context.report(
        loc
          ? { node, loc, messageId: "noKoreanLiteral" }
          : { node, messageId: "noKoreanLiteral" }
      );
    }

    function isIgnoredAttribute(attribute) {
      return ignoreAttributes.has(getAttributeName(attribute));
    }

    /**
     * JSX 에서 "렌더링 결과가 되는" 표현식만 따라 내려가며 한글 문자열을 찾는다.
     * 함수 호출 인수, 함수 본문, 객체, 비교식 등 렌더링 값이 아닌 위치는 탐색하지 않는다.
     * 중첩 JSX 는 별도 Visitor(JSXText / JSXExpressionContainer)가 처리하므로 여기서는 내려가지 않는다.
     */
    function checkRenderedExpression(node) {
      if (!node) {
        return;
      }

      if (TRANSPARENT_WRAPPERS.has(node.type)) {
        checkRenderedExpression(node.expression);
        return;
      }

      switch (node.type) {
        case "Literal":
          if (hasKorean(node.value)) {
            report(node);
          }
          return;

        case "TemplateLiteral":
          // 정적 구간(TemplateElement)에 한글이 있으면 TemplateLiteral 하나당 1건 보고
          if (node.quasis.some((quasi) => hasKorean(quasi.value.cooked))) {
            report(node);
          }
          // ${...} 보간식도 렌더링 결과에 포함된다
          node.expressions.forEach(checkRenderedExpression);
          return;

        case "ConditionalExpression":
          // test 는 렌더링되지 않는다
          checkRenderedExpression(node.consequent);
          checkRenderedExpression(node.alternate);
          return;

        case "LogicalExpression":
          // `a && b` 에서 a 가 렌더링되는 경우는 falsy 일 때뿐이고, 한글 문자열은 항상 truthy 이다
          if (node.operator !== "&&") {
            checkRenderedExpression(node.left);
          }
          checkRenderedExpression(node.right);
          return;

        case "BinaryExpression":
          // 문자열 연결만 렌더링 문자열을 만든다 (===, < 등은 boolean)
          if (node.operator === "+") {
            checkRenderedExpression(node.left);
            checkRenderedExpression(node.right);
          }
          return;

        case "ArrayExpression":
          node.elements.forEach((element) => {
            if (element && element.type === "SpreadElement") {
              checkRenderedExpression(element.argument);
            } else {
              checkRenderedExpression(element);
            }
          });
          return;

        case "SequenceExpression":
          checkRenderedExpression(node.expressions[node.expressions.length - 1]);
          return;

        case "CallExpression":
          // 인수는 검사하지 않는다 (t("..."), formatMessage("...") 허용).
          // 단, 메서드 호출의 수신 객체는 렌더링 값의 원본이므로 검사한다: ["사과"].join(", "), "안녕".trim()
          if (node.callee.type === "MemberExpression") {
            checkRenderedExpression(node.callee.object);
          }
          return;

        default:
          // Identifier, MemberExpression, 함수, 객체, JSXElement 등은 직접 검사하지 않는다
      }
    }

    return {
      JSXText(node) {
        if (!hasKorean(node.value)) {
          return;
        }

        // 앞뒤 공백/줄바꿈을 제외한 실제 텍스트 구간을 오류 위치로 사용한다
        const raw = sourceCode.getText(node);
        const start = node.range[0] + (raw.length - raw.trimStart().length);
        const end = node.range[0] + raw.trimEnd().length;

        report(node, {
          start: sourceCode.getLocFromIndex(start),
          end: sourceCode.getLocFromIndex(end),
        });
      },

      // 문자열 속성값: <input placeholder="이름" />
      // 표현식 속성값 placeholder={...} 은 JSXExpressionContainer 에서 처리한다
      JSXAttribute(node) {
        if (
          node.value &&
          node.value.type === "Literal" &&
          hasKorean(node.value.value) &&
          !isIgnoredAttribute(node)
        ) {
          report(node.value);
        }
      },

      // 자식 표현식 {...} 과 속성 표현식 attr={...} 모두 이 Visitor 하나에서 처리 (중복 보고 방지)
      JSXExpressionContainer(node) {
        if (node.expression.type === "JSXEmptyExpression") {
          return; // {/* 주석 */}
        }
        if (node.parent.type === "JSXAttribute" && isIgnoredAttribute(node.parent)) {
          return;
        }
        checkRenderedExpression(node.expression);
      },
    };
  },
};
