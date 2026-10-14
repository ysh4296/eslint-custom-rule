"use strict";

/**
 * 테스트 전용 파서: Babel 원본 AST 처럼 optional chaining 을
 * OptionalMemberExpression / OptionalCallExpression 으로 표현한다.
 *
 * espree / @typescript-eslint/parser / babel-eslint(10.x) 는 모두 ESTree 의 ChainExpression 으로 변환하므로,
 * Babel 계열 AST 를 그대로 넘기는 파서 환경을 재현하기 위해 espree 결과를 변환한다.
 */
const espree = require("espree");
const { KEYS } = require("eslint-visitor-keys");

const visitorKeys = {
  ...KEYS,
  OptionalMemberExpression: KEYS.MemberExpression,
  OptionalCallExpression: KEYS.CallExpression,
};

// ChainExpression 내부의 Member/Call 은 Babel 에서 모두 Optional* 노드다
function toOptional(node) {
  if (!node || typeof node.type !== "string") {
    return node;
  }
  if (node.type === "MemberExpression") {
    node.type = "OptionalMemberExpression";
    node.object = toOptional(node.object);
  } else if (node.type === "CallExpression") {
    node.type = "OptionalCallExpression";
    node.callee = toOptional(node.callee);
  }
  return node;
}

function transform(node) {
  if (!node || typeof node.type !== "string") {
    return node;
  }
  for (const key of visitorKeys[node.type] || []) {
    const child = node[key];
    if (Array.isArray(child)) {
      node[key] = child.map(transform);
    } else if (child && typeof child.type === "string") {
      node[key] = transform(child);
    }
  }
  return node.type === "ChainExpression" ? toOptional(node.expression) : node;
}

function parseForESLint(code, options) {
  const ast = espree.parse(code, {
    ...options,
    range: true,
    loc: true,
    tokens: true,
    comment: true,
  });
  return { ast: transform(ast), visitorKeys };
}

module.exports = { parseForESLint };
