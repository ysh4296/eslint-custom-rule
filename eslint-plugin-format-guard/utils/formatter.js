"use strict";

const { getCalleeName } = require("./ast");

/**
 * 포맷터 식별 로직.
 *
 * 현재 버전은 이름 기반으로만 판단한다 (함수명 / 메서드명).
 * import 경로나 심볼 검증을 추가할 때는 이 파일만 확장하면 된다. 예:
 *   - rule 에 `{ functions: [{ name: "formatDate", from: "@/utils/date" }] }` 형태를 허용하고
 *   - context.getScope() 로 callee 식별자의 정의(ImportBinding)를 찾아 ImportDeclaration.source 를 비교
 */

/** 포맷 대상 값이 호출식에서 차지하는 위치 */
const Role = Object.freeze({
  /** formatCount(value) — 값이 인수로 전달됨 → rule.functions 로 검증 */
  ARGUMENT: "argument",
  /** value.toLocaleString() — 값에 메서드를 직접 호출함 → rule.methods 로 검증 */
  RECEIVER: "receiver",
});

/**
 * `call` 이 `role` 위치의 값을 `rule` 기준으로 올바르게 포맷하는지 판단한다.
 * @param {import("estree").Node} call CallExpression / OptionalCallExpression / NewExpression / TaggedTemplateExpression
 * @param {{ functions: string[], methods: string[] }} rule 정규화된 설정 항목
 * @param {"argument" | "receiver"} role
 */
function isAllowedFormatter(call, rule, role) {
  const name = getCalleeName(call);
  if (name === null) {
    return false;
  }
  if (role === Role.RECEIVER) {
    return call.type !== "NewExpression" && rule.methods.includes(name);
  }
  return rule.functions.includes(name);
}

/** 어떤 rule 이든 함수형 포맷터로 등록된 이름인지 (utils.formatDate(x) 처럼 멤버 형태로 호출된 포맷 함수 판별용) */
function isRegisteredFunctionFormatter(call, rules) {
  const name = getCalleeName(call);
  return name !== null && rules.some((rule) => rule.functions.includes(name));
}

/** 오류 메시지용 허용 포맷 목록: "formatCount(), formatNumber(), .toLocaleString()" */
function describeAllowedFormatters(rule) {
  const items = [
    ...rule.functions.map((name) => `${name}()`),
    ...rule.methods.map((name) => `.${name}()`),
  ];
  return items.length > 0 ? items.join(", ") : "없음";
}

module.exports = {
  Role,
  isAllowedFormatter,
  isRegisteredFunctionFormatter,
  describeAllowedFormatters,
};
