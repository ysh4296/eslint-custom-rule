"use strict";

const { unwrap, isMemberExpression, getStaticPropertyName } = require("./ast");

/**
 * Zustand 룰(zustand-store-naming / zustand-require-shallow) 공용 유틸.
 *
 * TypeChecker 없이 import 선언과 스코프 분석(eslint-scope)만으로 판단한다.
 * - import 바인딩의 references 를 그대로 쓰므로 같은 이름의 로컬 변수(shadowing)와 구분된다.
 * - 파일 단위 결과는 AST(Program) 를 키로 하는 WeakMap 에 캐싱한다.
 *   같은 파일을 검사하는 두 룰이 결과를 공유하고, 다른 파일의 검사에는 영향을 주지 않는다.
 */

const DEFAULT_STORE_PATTERN = "^use[A-Z][A-Za-z0-9]*Store$";

// 스토어 훅을 만드는 export. "default" 는 기본 import, `import create from "zustand"` (v4 에서 deprecated)
const CREATE_EXPORTS = new Map([
  ["zustand", new Set(["create", "default"])],
  ["zustand/traditional", new Set(["createWithEqualityFn"])],
]);

const SHALLOW_EXPORTS = new Map([["zustand/shallow", new Set(["shallow"])]]);

// selector 를 감싸는 훅. v4.5 는 zustand/shallow 에서도 re-export 한다
const USE_SHALLOW_EXPORTS = new Map([
  ["zustand/shallow", new Set(["useShallow"])],
  ["zustand/react/shallow", new Set(["useShallow"])],
]);

function isZustandSource(source) {
  return source === "zustand" || source.startsWith("zustand/");
}

function toRegExp(pattern) {
  try {
    return new RegExp(pattern);
  } catch (error) {
    return null;
  }
}

/** 옵션의 이름 패턴. 스키마 검증을 거치지 않은 잘못된 값이면 기본 패턴을 쓴다 */
function resolveNamePattern(value) {
  const regex = typeof value === "string" ? toRegExp(value) : null;
  return regex
    ? { pattern: value, regex }
    : { pattern: DEFAULT_STORE_PATTERN, regex: new RegExp(DEFAULT_STORE_PATTERN) };
}

/** import 한 이름: `{ a as b }` → "a", 기본 import → "default", namespace import → "*" */
function getImportedName(specifier) {
  if (specifier.type === "ImportDefaultSpecifier") {
    return "default";
  }
  if (specifier.type === "ImportNamespaceSpecifier") {
    return "*";
  }
  const { imported } = specifier;
  return imported.type === "Identifier" ? imported.name : imported.value;
}

/**
 * `exportNames` 에 해당하는 바인딩의 사용 위치를 `target` 에 모은다.
 * - named / default import: 참조 Identifier (`create`, `createStore` (alias))
 * - namespace import: 멤버 접근 노드 (`zustand.create`)
 */
function collectReferences(variable, importedName, exportNames, target) {
  if (!exportNames) {
    return;
  }
  if (importedName !== "*") {
    if (exportNames.has(importedName)) {
      variable.references.forEach(({ identifier }) => target.add(identifier));
    }
    return;
  }
  variable.references.forEach(({ identifier }) => {
    const { parent } = identifier;
    if (
      isMemberExpression(parent) &&
      parent.object === identifier &&
      exportNames.has(getStaticPropertyName(parent))
    ) {
      target.add(parent);
    }
  });
}

/**
 * @typedef {object} ZustandImports
 * @property {Set<import("estree").Node>} createCallees  스토어를 만드는 함수의 사용 위치
 * @property {Set<import("estree").Node>} shallowRefs    `zustand/shallow` 의 shallow 사용 위치
 * @property {Set<import("estree").Node>} useShallowRefs `zustand/shallow`, `zustand/react/shallow` 의 useShallow 사용 위치
 * @property {{ variable: import("eslint").Scope.Variable, importedName: string }[]} importedBindings
 *   zustand 외 모듈에서 import 한 값 바인딩
 */

/** @returns {ZustandImports} */
function collectZustandImports(context, program) {
  const createCallees = new Set();
  const shallowRefs = new Set();
  const useShallowRefs = new Set();
  const importedBindings = [];

  // import 선언은 Program 최상위에만 올 수 있으므로 body 만 훑는다
  program.body.forEach((statement) => {
    if (statement.type !== "ImportDeclaration" || statement.importKind === "type") {
      return;
    }
    const source = statement.source.value;

    statement.specifiers.forEach((specifier) => {
      if (specifier.importKind === "type") {
        return; // import { type Foo } (TS)
      }
      const [variable] = context.getDeclaredVariables(specifier);
      if (!variable) {
        return;
      }

      if (isZustandSource(source)) {
        const importedName = getImportedName(specifier);
        collectReferences(variable, importedName, CREATE_EXPORTS.get(source), createCallees);
        collectReferences(variable, importedName, SHALLOW_EXPORTS.get(source), shallowRefs);
        collectReferences(variable, importedName, USE_SHALLOW_EXPORTS.get(source), useShallowRefs);
      } else {
        importedBindings.push({ variable, importedName: getImportedName(specifier) });
      }
    });
  });

  return { createCallees, shallowRefs, useShallowRefs, importedBindings };
}

const cache = new WeakMap();

/** @returns {ZustandImports} */
function getZustandImports(context) {
  const { ast } = context.getSourceCode();
  let imports = cache.get(ast);
  if (!imports) {
    imports = collectZustandImports(context, ast);
    cache.set(ast, imports);
  }
  return imports;
}

/**
 * Zustand 스토어 훅을 만드는 호출인지.
 * - `create(fn)`, `create(devtools(fn))`
 * - `create<T>()(fn)` / `create()(fn)` (curried)
 */
function isStoreCreateCall(node, createCallees) {
  const call = unwrap(node);
  if (!call || call.type !== "CallExpression" || call.arguments.length === 0) {
    return false;
  }
  const callee = unwrap(call.callee);
  if (createCallees.has(callee)) {
    return true;
  }
  return (
    Boolean(callee) &&
    callee.type === "CallExpression" &&
    callee.arguments.length === 0 &&
    createCallees.has(unwrap(callee.callee))
  );
}

/** `identifier(...)` 처럼 직접 호출된 경우 그 호출식. `useStore.getState()` 등 멤버 접근은 null */
function getDirectCall(identifier) {
  const { parent } = identifier;
  if (
    parent &&
    (parent.type === "CallExpression" || parent.type === "OptionalCallExpression") &&
    parent.callee === identifier
  ) {
    return parent;
  }
  return null;
}

module.exports = {
  DEFAULT_STORE_PATTERN,
  resolveNamePattern,
  getZustandImports,
  isStoreCreateCall,
  getDirectCall,
};
