"use strict";

/**
 * 샘플 룰: `example` 이라는 이름의 식별자 사용을 금지한다.
 * 개발 환경 동작 확인용이며, 실제 룰 작성 후 삭제해도 된다.
 */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "disallow identifiers named `example`",
      category: "Best Practices",
      recommended: false,
    },
    schema: [],
    messages: {
      noExample: "Identifier `example` is not allowed.",
    },
  },

  create(context) {
    return {
      Identifier(node) {
        if (node.name === "example") {
          context.report({ node, messageId: "noExample" });
        }
      },
    };
  },
};
