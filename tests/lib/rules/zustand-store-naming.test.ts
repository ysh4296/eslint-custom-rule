import assert from "assert";
import { ESLint, Linter, RuleTester } from "eslint";
import plugin from "../../../lib";
import rule from "../../../lib/rules/zustand-store-naming";

const DEFAULT_PATTERN = "^use[A-Z][A-Za-z0-9]*Store$";
const IMPORT = 'import { create } from "zustand";\n';

function invalidName(name: string, pattern: string = DEFAULT_PATTERN): RuleTester.TestCaseError {
  return { messageId: "invalidName", data: { name, pattern } };
}

// ---------------------------------------------------------------------------
// 정상 사례
// ---------------------------------------------------------------------------

const valid: (string | RuleTester.ValidTestCase)[] = [
  // 기본
  IMPORT + "const useUserStore = create(() => ({ count: 0 }));",
  IMPORT + "const useProductStore = create((set) => ({ products: [] }));",
  IMPORT + "export const useUserStore = create(() => ({}));",

  // curried create
  IMPORT + "const useUserStore = create()((set) => ({ count: 0 }));",

  // middleware 로 감싼 경우
  IMPORT + "const useUserStore = create(devtools(persist((set) => ({}), { name: 'user' })));",

  // import alias / 기본 import / namespace import
  'import { create as createStore } from "zustand"; const useUserStore = createStore(() => ({}));',
  'import create from "zustand"; const useUserStore = create(() => ({}));',
  'import * as zustand from "zustand"; const useUserStore = zustand.create(() => ({}));',
  'import { createWithEqualityFn } from "zustand/traditional"; const useUserStore = createWithEqualityFn(() => ({}));',

  // zustand 와 관계없는 create()
  'import { create } from "./factory"; const userStore = create(() => ({}));',
  "function create(fn) { return fn; } const userStore = create(() => ({}));",
  "const userStore = create(() => ({}));", // import 없는 전역 create
  'import { create } from "zustand"; function f(create) { const userStore = create(() => ({})); }', // shadowing
  'import { create } from "zustand"; const api = { create }; const userStore = api.create(() => ({}));',

  // 스토어 훅이 아닌 zustand API
  'import { createStore } from "zustand/vanilla"; const userStore = createStore(() => ({}));',
  'import { useStore } from "zustand"; const value = useStore(api, (s) => s.value);',
  IMPORT + "const makeStore = create();", // curried create 의 첫 호출만 한 경우 (아직 스토어가 아님)

  // 변수 선언이 아닌 경우 / 구조 분해
  IMPORT + "export default create(() => ({}));",
  IMPORT + "const [userStore] = [create(() => ({}))];",

  // 커스텀 패턴
  {
    code: IMPORT + "const useUser = create(() => ({}));",
    options: [{ pattern: "^use[A-Z][A-Za-z0-9]*$" }],
  },
];

// ---------------------------------------------------------------------------
// 오류 사례
// ---------------------------------------------------------------------------

const invalid: RuleTester.InvalidTestCase[] = [
  { code: IMPORT + "const userStore = create(() => ({ count: 0 }));", errors: [invalidName("userStore")] },
  { code: IMPORT + "const useUser = create(() => ({ count: 0 }));", errors: [invalidName("useUser")] },
  { code: IMPORT + "const usestore = create(() => ({}));", errors: [invalidName("usestore")] },
  { code: IMPORT + "export const UserStore = create(() => ({}));", errors: [invalidName("UserStore")] },

  // curried create / middleware
  { code: IMPORT + "const userStore = create()((set) => ({}));", errors: [invalidName("userStore")] },
  { code: IMPORT + "const userStore = create(devtools((set) => ({})));", errors: [invalidName("userStore")] },

  // import alias / 기본 import / namespace import / traditional
  {
    code: 'import { create as createStore } from "zustand"; const userStore = createStore(() => ({}));',
    errors: [invalidName("userStore")],
  },
  {
    code: 'import create from "zustand"; const userStore = create(() => ({}));',
    errors: [invalidName("userStore")],
  },
  {
    code: 'import * as zustand from "zustand"; const userStore = zustand.create(() => ({}));',
    errors: [invalidName("userStore")],
  },
  {
    code: 'import { createWithEqualityFn } from "zustand/traditional"; const userStore = createWithEqualityFn(() => ({}));',
    errors: [invalidName("userStore")],
  },

  // 함수 안에서 선언한 스토어
  { code: IMPORT + "function setup() { const userStore = create(() => ({})); }", errors: [invalidName("userStore")] },

  // 여러 스토어
  {
    code: IMPORT + "const useUserStore = create(() => ({}));\nconst product = create(() => ({}));\nconst useCart = create(() => ({}));",
    errors: [invalidName("product"), invalidName("useCart")],
  },

  // 오류 위치
  {
    code: IMPORT + "const userStore = create(() => ({}));",
    errors: [{ ...invalidName("userStore"), line: 2, column: 7, endColumn: 16 }],
  },

  // 커스텀 패턴
  {
    code: IMPORT + "const useUserStore = create(() => ({}));",
    options: [{ pattern: "^use[A-Z][A-Za-z0-9]*State$" }],
    errors: [invalidName("useUserStore", "^use[A-Z][A-Za-z0-9]*State$")],
  },
];

// ---------------------------------------------------------------------------
// 실행: espree(JSX) / @typescript-eslint/parser(TSX) / babel-eslint
// ---------------------------------------------------------------------------

const parserOptions: Linter.ParserOptions = { ecmaVersion: 2020, sourceType: "module", ecmaFeatures: { jsx: true } };

describe("zustand-store-naming", () => {
  describe("espree (JSX)", () => {
    new RuleTester({ parserOptions }).run("zustand-store-naming", rule, { valid, invalid });
  });

  describe("@typescript-eslint/parser (TSX)", () => {
    const tester = new RuleTester({
      parser: require.resolve("@typescript-eslint/parser"),
      parserOptions,
    });

    tester.run("zustand-store-naming", rule, { valid, invalid });

    tester.run("zustand-store-naming (TS syntax)", rule, {
      valid: [
        IMPORT + "const useUserStore = create<UserState>()((set) => ({ count: 0 }));",
        IMPORT + "const useUserStore = create<UserState>((set) => ({ count: 0 }));",
        IMPORT + "const useUserStore = create<UserState>()(devtools((set) => ({ count: 0 })));",
        'import { create, type StateCreator } from "zustand"; const useUserStore = create<S>()(() => ({}));',
        'import type { StoreApi } from "zustand"; const userStore = create<S>()(() => ({}));',
        IMPORT + "const userStore: StoreApi<S> = createStore<S>()(() => ({}));",
      ],
      invalid: [
        {
          code: IMPORT + "const userStore = create<UserState>()((set) => ({ count: 0 }));",
          errors: [invalidName("userStore")],
        },
        {
          code: IMPORT + "const useUser = create<UserState>((set) => ({ count: 0 }));",
          errors: [invalidName("useUser")],
        },
        {
          code: IMPORT + "const userStore: UseBoundStore<StoreApi<S>> = create<S>()(() => ({}));",
          errors: [invalidName("userStore")],
        },
        {
          code: IMPORT + "const userStore = create<S>()(() => ({})) as UseBoundStore<StoreApi<S>>;",
          errors: [invalidName("userStore")],
        },
        {
          code: 'import { create, type StateCreator } from "zustand"; const userStore = create<S>()(() => ({}));',
          errors: [invalidName("userStore")],
        },
      ],
    });
  });

  describe("babel-eslint", () => {
    new RuleTester({ parser: require.resolve("babel-eslint"), parserOptions }).run(
      "zustand-store-naming",
      rule,
      { valid, invalid }
    );
  });

  describe("options schema (.eslintrc 설정 로딩 경로)", () => {
    async function lintWith(options: unknown[]): Promise<Linter.LintMessage[]> {
      const eslint = new ESLint({
        useEslintrc: false,
        plugins: { "custom-rule": plugin },
        overrideConfig: {
          parserOptions,
          plugins: ["custom-rule"],
          rules: { "custom-rule/zustand-store-naming": ["warn", ...options] } as Linter.RulesRecord,
        },
      });
      const [result] = await eslint.lintText(IMPORT + "const userStore = create(() => ({}));");
      return result.messages;
    }

    it("accepts no options and a valid pattern", async () => {
      for (const options of [[], [{}], [{ pattern: DEFAULT_PATTERN }]]) {
        const messages = await lintWith(options);
        assert.deepStrictEqual(
          messages.map((m) => m.ruleId),
          ["custom-rule/zustand-store-naming"]
        );
      }
    });

    const invalidConfigs = {
      "invalid regex pattern": [{ pattern: "use(" }],
      "empty pattern": [{ pattern: "" }],
      "non-string pattern": [{ pattern: 1 }],
      "unknown property": [{ storePattern: DEFAULT_PATTERN }],
    };

    Object.entries(invalidConfigs).forEach(([title, options]) => {
      it(`rejects ${title}`, async () => {
        await assert.rejects(
          () => lintWith(options),
          /Configuration for rule "custom-rule\/zustand-store-naming" is invalid/
        );
      });
    });
  });

  describe("스키마 검증을 거치지 않는 직접 호출 (Linter)", () => {
    const linter = new Linter();
    linter.defineRule("zustand-store-naming", rule);

    it("falls back to the default pattern with an invalid regex", () => {
      const messages = linter.verify(IMPORT + "const userStore = create(() => ({}));", {
        parserOptions,
        rules: { "zustand-store-naming": ["warn", { pattern: "use(" }] } as Linter.RulesRecord,
      });
      assert.deepStrictEqual(
        messages.map((m) => m.message),
        [`Zustand 스토어 훅 'userStore' 의 이름은 패턴 ${DEFAULT_PATTERN} 과(와) 일치해야 합니다.`]
      );
    });
  });
});
