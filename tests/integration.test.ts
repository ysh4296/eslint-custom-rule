import assert from "assert";
import path from "path";
import { ESLint, Linter } from "eslint";
import plugin from "../lib";

const SAMPLE = path.join(__dirname, "../playground/Sample.tsx");
const RULE_ID = "custom-rule/no-korean-literal-in-jsx";

// 외부 프로젝트처럼 `custom-rule` 플러그인 이름(접두사)으로 등록해 실제 TSX 파일을 lint 한다
function createESLint(rules: Linter.RulesRecord): ESLint {
  return new ESLint({
    useEslintrc: false,
    ignore: false,
    plugins: { "custom-rule": plugin },
    overrideConfig: {
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      plugins: ["custom-rule"],
      rules,
    },
  });
}

async function lintSample(rules: Linter.RulesRecord): Promise<Linter.LintMessage[]> {
  const [result] = await createESLint(rules).lintFiles([SAMPLE]);
  return result.messages;
}

describe("integration: playground/Sample.tsx", () => {
  it("reports only rendered Korean literals at the expected locations", async () => {
    const messages = await lintSample({ [RULE_ID]: "error" });

    assert.deepStrictEqual(
      messages.map((m) => [m.ruleId, m.line, m.column]),
      [
        [RULE_ID, 15, 7], // 안녕하세요 (JSXText)
        [RULE_ID, 16, 21], // title="저장하기"
        [RULE_ID, 17, 9], // 저장 (JSXText)
        [RULE_ID, 19, 14], // {"삭제"}
        [RULE_ID, 21, 22], // "활성"
        [RULE_ID, 21, 29], // "비활성"
        [RULE_ID, 22, 19], // "이름 없음"
        [RULE_ID, 23, 12], // "사과"
        [RULE_ID, 23, 18], // "바나나"
        [RULE_ID, 24, 11], // `안녕하세요 ${name}님`
      ]
    );
  });

  it("does not change results of other rules", async () => {
    const otherRules: Linter.RulesRecord = { "no-unused-vars": "error", eqeqeq: "error" };
    const withoutPlugin = await lintSample(otherRules);
    const withPlugin = await lintSample({ ...otherRules, [RULE_ID]: "error" });

    // 비교가 의미 있도록 다른 룰이 실제로 오류를 내는지 먼저 확인 (React import 미사용 등)
    assert.ok(withoutPlugin.length > 0);
    assert.ok(withoutPlugin.every((m) => m.ruleId !== null && m.ruleId in otherRules));

    assert.deepStrictEqual(
      withPlugin.filter((m) => m.ruleId !== RULE_ID),
      withoutPlugin
    );
  });
});
