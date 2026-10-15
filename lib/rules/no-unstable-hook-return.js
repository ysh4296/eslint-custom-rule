"use strict";

const { unwrap } = require("../utils/ast");
const { findVariable, getWrittenValue } = require("../utils/scope");

const HOOK_NAME = /^use[A-Z]/;

/**
 * 커스텀 훅 이름. 훅이 아니면 null
 * - `function useX() {}`
 * - `const useX = () => {}` / `const useX = function () {}` (TS 래퍼로 감싼 경우 포함)
 */
function getHookName(fn) {
  if (fn.type === "FunctionDeclaration") {
    return fn.id && HOOK_NAME.test(fn.id.name) ? fn.id.name : null;
  }

  let node = fn;
  while (node.parent && unwrap(node.parent) === fn) {
    node = node.parent;
  }
  const { parent } = node;
  if (
    parent &&
    parent.type === "VariableDeclarator" &&
    parent.init === node &&
    parent.id.type === "Identifier" &&
    HOOK_NAME.test(parent.id.name)
  ) {
    return parent.id.name;
  }
  return null;
}

/** 객체 프로퍼티의 정적인 키 이름. `a: 1` / `"a": 1` / `["a"]: 1` → "a", `[key]: 1` → null */
function getPropertyName(property) {
  const { key } = property;
  if (!property.computed && key.type === "Identifier") {
    return key.name;
  }
  if (key.type === "Literal" && (typeof key.value === "string" || typeof key.value === "number")) {
    return String(key.value);
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "disallow custom hooks from returning functions that are re-created on every render",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
    messages: {
      unstableReturn:
        "커스텀 훅 '{{hook}}' 이(가) 반환하는 '{{name}}' 은(는) 렌더링마다 새로 생성되는 함수입니다. useCallback 으로 감싸서 반환하세요.",
      unstableInlineReturn:
        "커스텀 훅 '{{hook}}' 이(가) 렌더링마다 새로 생성되는 함수를 반환합니다. useCallback 으로 감싸서 반환하세요.",
    },
  },

  create(context) {
    const { scopeManager } = context.getSourceCode();

    // 파일 단위 캐시. create() 가 파일마다 호출되므로 검사가 끝나면 함께 해제된다
    /** @type {Map<import("eslint").Scope.Variable, boolean>} */
    const freshVariables = new Map();
    /** @type {Set<unknown>} 이미 보고한 변수 / 인라인 함수 노드 */
    const reported = new Set();
    /** 현재 함수 스택. 훅이면 { name, scope }, 아니면 null */
    const functionStack = [];

    /**
     * 값이 어느 분기에서든 "이번 실행에서 새로 만든 함수" 일 수 있는지.
     * 함수 호출 결과(useCallback(), getHandler() 등)는 안정성을 알 수 없으므로 false
     */
    function mayCreateFunction(node, scope) {
      const value = unwrap(node);
      if (!value) {
        return false;
      }
      switch (value.type) {
        case "ArrowFunctionExpression":
        case "FunctionExpression":
          return true;
        case "ConditionalExpression":
          return mayCreateFunction(value.consequent, scope) || mayCreateFunction(value.alternate, scope);
        case "LogicalExpression":
          // `a && b` 의 a 는 falsy 일 때만 결과가 되므로 함수일 수 없다
          return (
            (value.operator !== "&&" && mayCreateFunction(value.left, scope)) ||
            mayCreateFunction(value.right, scope)
          );
        case "SequenceExpression":
          return mayCreateFunction(value.expressions[value.expressions.length - 1], scope);
        case "Identifier": {
          // 같은 함수 실행 안에서 선언된 변수만 따라간다 (바깥 함수/모듈 스코프 변수는 이번 실행에서 만들어지지 않음)
          const variable = findVariable(scope, value.name);
          return (
            Boolean(variable) &&
            variable.scope.variableScope === scope.variableScope &&
            isFreshVariable(variable)
          );
        }
        default:
          return false;
      }
    }

    /**
     * 변수가 선언된 함수가 실행될 때마다 새 함수를 담는지.
     * - 함수 선언문
     * - 같은 함수 안의 `= value` 대입 중 하나라도 새 함수일 수 있는 값 (재할당 포함)
     * 중첩 함수(useEffect 콜백 등) 안의 대입은 실행 시점을 알 수 없으므로 보지 않는다.
     */
    function isFreshVariable(variable) {
      if (freshVariables.has(variable)) {
        return freshVariables.get(variable);
      }
      freshVariables.set(variable, false); // 순환 참조 (`a = b; b = a`) 방지

      const fresh =
        variable.defs.some((def) => def.type === "FunctionName" && def.node.type === "FunctionDeclaration") ||
        variable.references.some((reference) => {
          if (!reference.isWrite() || reference.from.variableScope !== variable.scope.variableScope) {
            return false;
          }
          const value = getWrittenValue(reference);
          return Boolean(value) && mayCreateFunction(value, reference.from);
        });

      freshVariables.set(variable, fresh);
      return fresh;
    }

    function reportOnce(key, node, hook, name) {
      if (reported.has(key)) {
        return;
      }
      reported.add(key);
      context.report(
        name
          ? { node, messageId: "unstableReturn", data: { hook: hook.name, name } }
          : { node, messageId: "unstableInlineReturn", data: { hook: hook.name } }
      );
    }

    /** 반환되는 값 하나 (객체 프로퍼티 값, 배열 요소, 직접 반환 값) */
    function checkValue(node, name, hook, scope) {
      const value = unwrap(node);
      if (!value) {
        return;
      }
      switch (value.type) {
        case "ArrowFunctionExpression":
        case "FunctionExpression":
          reportOnce(value, value, hook, name);
          return;
        case "Identifier": {
          // 훅 자신의 실행 안에서 선언된 변수만 검사한다 (모듈 / 바깥 함수 스코프, 매개변수 대입 없는 값은 제외)
          const variable = findVariable(scope, value.name);
          if (variable && variable.scope.variableScope === hook.scope && isFreshVariable(variable)) {
            reportOnce(variable, value, hook, value.name);
          }
          return;
        }
        case "ConditionalExpression":
          checkValue(value.consequent, name, hook, scope);
          checkValue(value.alternate, name, hook, scope);
          return;
        case "LogicalExpression":
          if (value.operator !== "&&") {
            checkValue(value.left, name, hook, scope);
          }
          checkValue(value.right, name, hook, scope);
          return;
        case "SequenceExpression":
          checkValue(value.expressions[value.expressions.length - 1], name, hook, scope);
          return;
        default:
      }
    }

    /** return 문의 값. 최상위 객체 / 배열 / 조건부 반환까지 펼친다 (중첩 객체는 보지 않음) */
    function checkReturned(node, hook, scope) {
      const value = unwrap(node);
      if (!value) {
        return;
      }
      switch (value.type) {
        case "ObjectExpression":
          value.properties.forEach((property) => {
            if (property.type !== "Property" || property.kind !== "init") {
              return; // spread, getter / setter
            }
            if (property.method) {
              reportOnce(property, property, hook, getPropertyName(property));
              return;
            }
            checkValue(property.value, getPropertyName(property), hook, scope);
          });
          return;
        case "ArrayExpression":
          value.elements.forEach((element) => {
            if (element && element.type !== "SpreadElement") {
              checkValue(element, null, hook, scope);
            }
          });
          return;
        case "ConditionalExpression":
          checkReturned(value.consequent, hook, scope);
          checkReturned(value.alternate, hook, scope);
          return;
        case "LogicalExpression":
          if (value.operator !== "&&") {
            checkReturned(value.left, hook, scope);
          }
          checkReturned(value.right, hook, scope);
          return;
        case "SequenceExpression":
          checkReturned(value.expressions[value.expressions.length - 1], hook, scope);
          return;
        default:
          checkValue(value, null, hook, scope);
      }
    }

    function enterFunction(node) {
      const name = getHookName(node);
      functionStack.push(name ? { name, scope: scopeManager.acquire(node, true) } : null);
    }

    function exitFunction(node) {
      const hook = functionStack.pop();
      if (hook && node.body.type !== "BlockStatement") {
        checkReturned(node.body, hook, hook.scope); // `const useX = () => value`
      }
    }

    return {
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      "FunctionExpression:exit": exitFunction,
      "ArrowFunctionExpression:exit": exitFunction,

      // 가장 가까운 함수가 훅일 때만 훅의 반환으로 본다 (중첩 함수 / 콜백의 return 제외)
      ReturnStatement(node) {
        const hook = functionStack[functionStack.length - 1];
        if (hook && node.argument) {
          checkReturned(node.argument, hook, context.getScope());
        }
      },
    };
  },
};
