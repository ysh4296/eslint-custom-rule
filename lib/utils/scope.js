"use strict";

/**
 * eslint-scope 공용 유틸.
 */

/** `scope` 에서 바깥쪽으로 올라가며 `name` 의 바인딩을 찾는다. 선언되지 않은 전역 이름이면 null */
function findVariable(initialScope, name) {
  let scope = initialScope;
  while (scope) {
    const variable = scope.set.get(name);
    if (variable) {
      return variable;
    }
    scope = scope.upper;
  }
  return null;
}

/**
 * 쓰기 참조가 대입한 값.
 * `const x = value` / `x = value` 만 다룬다. 구조 분해, `+=`, `x++`, for-in/of 는 값을 알 수 없으므로 null
 */
function getWrittenValue(reference) {
  const { identifier } = reference;
  const { parent } = identifier;
  if (!parent) {
    return null;
  }
  if (parent.type === "VariableDeclarator" && parent.id === identifier) {
    return parent.init;
  }
  if (parent.type === "AssignmentExpression" && parent.left === identifier && parent.operator === "=") {
    return parent.right;
  }
  return null;
}

module.exports = {
  findVariable,
  getWrittenValue,
};
