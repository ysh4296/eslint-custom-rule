"use strict";

const { unwrap } = require("../utils/ast");
const {
  resolveNamePattern,
  getZustandImports,
  isStoreCreateCall,
  getDirectCall,
} = require("../utils/zustand");

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "require Zustand store hooks to be called with a selector and shallow (or useShallow) from zustand",
      category: "Best Practices",
      recommended: false,
    },
    schema: [
      {
        type: "object",
        properties: {
          storePattern: { type: "string", minLength: 1, format: "regex" },
          allowNoSelector: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingShallow:
        "'{{name}}' 호출에는 selector 를 useShallow 로 감싸거나 두 번째 인자로 'zustand/shallow' 의 shallow 를 전달해야 합니다.",
      invalidEqualityFn:
        "'{{name}}' 의 두 번째 인자 '{{argument}}' 은(는) 'zustand/shallow' 에서 import 한 shallow 가 아닙니다.",
      missingSelector:
        "'{{name}}' 을(를) selector 없이 호출하면 스토어 전체를 구독합니다. selector 와 shallow 를 전달해야 합니다.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const { regex } = resolveNamePattern(options.storePattern);
    const allowNoSelector = options.allowNoSelector === true;
    const sourceCode = context.getSourceCode();
    let imports = null;

    /** `useShallow(selector)`: zustand 에서 import 한 useShallow 를 실제로 참조하는 호출인지 */
    function isUseShallowCall(node) {
      const call = unwrap(node);
      return (
        Boolean(call) &&
        call.type === "CallExpression" &&
        call.arguments.length > 0 &&
        imports.useShallowRefs.has(unwrap(call.callee))
      );
    }

    function checkCall(call, name) {
      const args = call.arguments;
      if (args.some((arg) => arg.type === "SpreadElement")) {
        return; // useStore(...args): 인자를 정적으로 알 수 없음
      }

      if (args.length === 0) {
        if (!allowNoSelector) {
          context.report({ node: call, messageId: "missingSelector", data: { name } });
        }
        return;
      }

      if (args.length < 2) {
        if (isUseShallowCall(args[0])) {
          return; // useX(useShallow(selector))
        }
        context.report({ node: call, messageId: "missingShallow", data: { name } });
        return;
      }

      if (!imports.shallowRefs.has(unwrap(args[1]))) {
        context.report({
          node: args[1],
          messageId: "invalidEqualityFn",
          data: { name, argument: sourceCode.getText(args[1]) },
        });
      }
    }

    /** 스토어 훅 변수의 모든 참조 중 직접 호출만 검사한다. getState() / setState() / subscribe() 는 제외됨 */
    function checkStore(variable) {
      variable.references.forEach(({ identifier }) => {
        const call = getDirectCall(identifier);
        if (call) {
          checkCall(call, identifier.name);
        }
      });
    }

    return {
      Program() {
        imports = getZustandImports(context);

        // 다른 파일의 스토어: 선언을 볼 수 없으므로 이름(원래 export 이름 또는 로컬 alias)으로 판단
        imports.importedBindings.forEach(({ variable, importedName }) => {
          if (regex.test(importedName) || regex.test(variable.name)) {
            checkStore(variable);
          }
        });
      },

      // 같은 파일의 스토어: create() 로 선언된 것을 이름과 관계없이 검사
      VariableDeclarator(node) {
        if (
          imports.createCallees.size === 0 ||
          node.id.type !== "Identifier" ||
          !isStoreCreateCall(node.init, imports.createCallees)
        ) {
          return;
        }
        context.getDeclaredVariables(node).forEach(checkStore);
      },
    };
  },
};
