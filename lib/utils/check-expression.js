"use strict";

const {
  unwrap,
  isMemberExpression,
  isFunctionExpression,
  getReferenceName,
  getCallee,
  getCallArguments,
  getCalleeName,
} = require("./ast");
const { Role, isAllowedFormatter, isRegisteredFunctionFormatter } = require("./formatter");

// 결과가 피연산자 값에서 계산되는 연산자. 비교/관계 연산자(===, <, in, instanceof)는 boolean 이라 제외
const VALUE_BINARY_OPERATORS = new Set([
  "+", "-", "*", "/", "%", "**", "|", "&", "^", "<<", ">>", ">>>",
]);
const VALUE_UNARY_OPERATORS = new Set(["-", "+", "~"]);

/**
 * @typedef {{ pattern: string, regex: RegExp, functions: string[], methods: string[] }} FormatRule
 * @typedef {{ node: import("estree").Node, rule: FormatRule, via: string | null }} Unformatted
 *   node: 포맷되지 않은 값 참조 (Identifier / MemberExpression)
 *   via:  값이 통과한 "허용되지 않은 포맷" 호출 이름 (없으면 null)
 */

/**
 * @param {FormatRule[]} rules
 */
function createExpressionChecker(rules) {
  /** 변수명 / 말단 필드명이 패턴과 일치하는 첫 번째 rule */
  function findRule(node) {
    const name = getReferenceName(node);
    if (name === null) {
      return null;
    }
    return rules.find((rule) => rule.regex.test(name)) || null;
  }

  /** `call` 을 통과한 값들 중, 이 호출로 올바르게 포맷되지 않은 것만 남긴다 */
  function passThrough(entries, call, role) {
    const via = getCalleeName(call) || "(anonymous)";
    return entries
      .filter((entry) => !isAllowedFormatter(call, entry.rule, role))
      .map((entry) => (entry.via ? entry : { node: entry.node, rule: entry.rule, via }));
  }

  function checkAll(nodes) {
    const result = [];
    nodes.forEach((node) => {
      if (!node) {
        return; // 배열 hole: [a, , b]
      }
      result.push(...checkExpression(node.type === "SpreadElement" ? node.argument : node));
    });
    return result;
  }

  function checkCall(call) {
    const args = getCallArguments(call);

    // map / filter / reduce 처럼 콜백을 받는 호출의 결과는 콜백이 만든다.
    // ([...Array(pageCount)].map(...), list.slice(0, visibleCount).map(...) 의 오탐 방지)
    if (args.some((arg) => isFunctionExpression(unwrap(arg)))) {
      return [];
    }

    const callee = getCallee(call);
    const isMethodCall =
      call.type !== "NewExpression" &&
      call.type !== "TaggedTemplateExpression" &&
      isMemberExpression(callee) &&
      !isRegisteredFunctionFormatter(call, rules);

    if (isMethodCall) {
      // value.method(): 수신 객체의 값이 메서드를 통과한다.
      // 메서드 인수는 추적하지 않는다 (items.slice(0, visibleCount) 등은 인수가 렌더링되지 않음)
      return passThrough(checkExpression(callee.object), call, Role.RECEIVER);
    }

    // fn(value), utils.formatX(value), new Date(value), tag`${value}`: 인수 값이 함수를 통과한다
    return passThrough(checkAll(args), call, Role.ARGUMENT);
  }

  /**
   * 렌더링 위치의 표현식에서 시작해, 최종 값에 그대로 흘러드는(포맷되지 않은) 값 참조를 모두 찾는다.
   * 포맷된 하위 표현식은 결과에서 제외되므로 같은 참조가 중복 보고되지 않는다.
   * 지원하지 않는 노드는 빈 배열을 반환한다 (예외를 던지지 않음).
   * @returns {Unformatted[]}
   */
  function checkExpression(node) {
    const target = unwrap(node);
    if (!target) {
      return [];
    }

    if (target.type === "Identifier" || isMemberExpression(target)) {
      const rule = findRule(target);
      return rule ? [{ node: target, rule, via: null }] : [];
    }

    switch (target.type) {
      case "CallExpression":
      case "OptionalCallExpression":
      case "NewExpression":
      case "TaggedTemplateExpression":
        return checkCall(target);

      case "ConditionalExpression":
        // test 는 렌더링되지 않는다
        return [...checkExpression(target.consequent), ...checkExpression(target.alternate)];

      case "LogicalExpression":
        // `a && b`: a 는 렌더링 조건 (userCount > 0 && <X />). `a || b`, `a ?? b`: a 도 그대로 렌더링됨
        return target.operator === "&&"
          ? checkExpression(target.right)
          : [...checkExpression(target.left), ...checkExpression(target.right)];

      case "BinaryExpression":
        return VALUE_BINARY_OPERATORS.has(target.operator)
          ? [...checkExpression(target.left), ...checkExpression(target.right)]
          : [];

      case "UnaryExpression":
        return VALUE_UNARY_OPERATORS.has(target.operator) ? checkExpression(target.argument) : [];

      case "TemplateLiteral":
        return checkAll(target.expressions);

      case "ArrayExpression":
        return checkAll(target.elements);

      case "SequenceExpression":
        return checkExpression(target.expressions[target.expressions.length - 1]);

      case "AssignmentExpression":
        return target.operator === "="
          ? checkExpression(target.right)
          : [...checkExpression(target.left), ...checkExpression(target.right)];

      case "AwaitExpression":
        return checkExpression(target.argument);

      default:
        // Literal, 함수, 객체, JSX(중첩 JSX 는 Visitor 가 따로 방문) 등
        return [];
    }
  }

  return { checkExpression, findRule };
}

module.exports = { createExpressionChecker };
