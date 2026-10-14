"use strict";

/**
 * 파서별 AST 차이를 흡수하는 공통 유틸.
 * - espree / @typescript-eslint/parser: optional chaining → ChainExpression + MemberExpression(optional: true)
 * - babel-eslint: optional chaining → OptionalMemberExpression / OptionalCallExpression
 */

// 값을 바꾸지 않고 감싸기만 하는 노드. 내부 expression 이 그대로 값이 된다.
const TRANSPARENT_WRAPPERS = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TypeCastExpression",
]);

function unwrap(node) {
  let current = node;
  while (current && TRANSPARENT_WRAPPERS.has(current.type)) {
    current = current.expression;
  }
  return current || null;
}

function isMemberExpression(node) {
  return Boolean(node) && (node.type === "MemberExpression" || node.type === "OptionalMemberExpression");
}

function isCallLike(node) {
  return (
    Boolean(node) &&
    (node.type === "CallExpression" ||
      node.type === "OptionalCallExpression" ||
      node.type === "NewExpression" ||
      node.type === "TaggedTemplateExpression")
  );
}

function isFunctionExpression(node) {
  return (
    Boolean(node) &&
    (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression")
  );
}

/** 멤버 접근의 정적인 속성 이름. `a.b` → "b", `a["b"]` → "b", `a[key]` → null */
function getStaticPropertyName(member) {
  const { property } = member;
  if (!property) {
    return null;
  }

  if (!member.computed) {
    if (property.type === "Identifier" || property.type === "PrivateIdentifier") {
      return property.name;
    }
    if (property.type === "PrivateName" && property.id) {
      return property.id.name; // babel
    }
    return null;
  }

  if (property.type === "Literal" && typeof property.value === "string") {
    return property.value;
  }
  if (property.type === "StringLiteral") {
    return property.value; // babel (estree 미변환)
  }
  if (property.type === "TemplateLiteral" && property.expressions.length === 0) {
    return property.quasis[0].value.cooked;
  }
  return null;
}

/** 값 참조의 이름: 변수명 또는 객체의 말단 필드명. 그 외 노드는 null */
function getReferenceName(node) {
  if (!node) {
    return null;
  }
  if (node.type === "Identifier") {
    return node.name;
  }
  if (isMemberExpression(node)) {
    return getStaticPropertyName(node);
  }
  return null;
}

function getCallee(call) {
  return unwrap(call.type === "TaggedTemplateExpression" ? call.tag : call.callee);
}

function getCallArguments(call) {
  if (call.type === "TaggedTemplateExpression") {
    return call.quasi.expressions;
  }
  return call.arguments || [];
}

/** 호출 이름: `formatDate(x)` → "formatDate", `utils.formatDate(x)` / `x.toLocaleString()` → 메서드 이름 */
function getCalleeName(call) {
  return getReferenceName(getCallee(call));
}

module.exports = {
  unwrap,
  isMemberExpression,
  isCallLike,
  isFunctionExpression,
  getStaticPropertyName,
  getReferenceName,
  getCallee,
  getCallArguments,
  getCalleeName,
};
