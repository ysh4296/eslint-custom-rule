"use strict";

const assert = require("assert");
const path = require("path");
const { ESLint } = require("eslint");
const plugin = require("..");

const ROOT = path.join(__dirname, "..");
const EXAMPLE = path.join(ROOT, "examples/App.tsx");
const RULE_ID = "format-guard/require-format";

describe("plugin", () => {
  it("exports the require-format rule", () => {
    assert.deepStrictEqual(Object.keys(plugin.rules), ["require-format"]);
    assert.strictEqual(typeof plugin.rules["require-format"].create, "function");
  });

  it("is loaded by name from examples/.eslintrc.json and reports App.tsx", async () => {
    // 플러그인을 직접 주입하지 않고, 설정 파일의 "plugins": ["format-guard"] 로 패키지를 해석해 로드한다
    const eslint = new ESLint({ cwd: ROOT, resolvePluginsRelativeTo: ROOT });
    const [result] = await eslint.lintFiles([EXAMPLE]);

    assert.deepStrictEqual(
      result.messages.map((m) => [m.ruleId, m.severity, m.line, m.column, m.messageId]),
      [
        [RULE_ID, 1, 29, 11, "unformatted"], // {userCount}
        [RULE_ID, 1, 30, 11, "unformatted"], // {response.data.user.profile.createdDate}
        [RULE_ID, 1, 31, 11, "unformatted"], // {response?.data?.userCount}
        [RULE_ID, 1, 32, 18, "invalidFormatter"], // String(userCount)
        [RULE_ID, 1, 33, 22, "invalidFormatter"], // formatDate(userCount)
        [RULE_ID, 1, 34, 40, "unformatted"], // ... + additionalCount
        [RULE_ID, 1, 35, 51, "unformatted"], // ... : totalCount
        [RULE_ID, 1, 36, 16, "unformatted"], // `총 ${userCount}명`
      ]
    );
  });

  it("does not change results of other rules", async () => {
    const otherRules = { "no-unused-vars": "error", eqeqeq: "error", "prefer-const": "error" };

    async function lint(rules) {
      const eslint = new ESLint({
        cwd: ROOT,
        resolvePluginsRelativeTo: ROOT,
        overrideConfig: { rules },
      });
      const [result] = await eslint.lintFiles([EXAMPLE]);
      return result.messages;
    }

    const withPlugin = await lint(otherRules);
    const withoutPlugin = await lint({ ...otherRules, [RULE_ID]: "off" });

    assert.ok(withoutPlugin.length > 0, "other rules should report something to compare");
    assert.ok(withoutPlugin.every((m) => m.ruleId !== null && m.ruleId in otherRules));
    assert.deepStrictEqual(
      withPlugin.filter((m) => m.ruleId !== RULE_ID),
      withoutPlugin
    );
  });
});
