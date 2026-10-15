import assert from "assert";
import { ESLint, Linter, RuleTester } from "eslint";
import plugin from "../../../lib";
import rule from "../../../lib/rules/zustand-require-shallow";

// 다른 파일에서 import 한 스토어 + shallow
const STORE = 'import { useUserStore } from "./stores";\n';
const SHALLOW = 'import { shallow } from "zustand/shallow";\n';
const IMPORTS = STORE + SHALLOW;
// 같은 파일에서 create() 로 선언한 스토어
const LOCAL_STORE = 'import { create } from "zustand";\nconst useProductStore = create(() => ({ products: [] }));\n';

function missingShallow(name = "useUserStore"): RuleTester.TestCaseError {
  return { messageId: "missingShallow", data: { name } };
}

function invalidEqualityFn(argument: string, name = "useUserStore"): RuleTester.TestCaseError {
  return { messageId: "invalidEqualityFn", data: { name, argument } };
}

function missingSelector(name = "useUserStore"): RuleTester.TestCaseError {
  return { messageId: "missingSelector", data: { name } };
}

// ---------------------------------------------------------------------------
// 정상 사례
// ---------------------------------------------------------------------------

const valid: (string | RuleTester.ValidTestCase)[] = [
  // selector + shallow: 단일 원시값 / 객체 / 배열
  IMPORTS + "const count = useUserStore((state) => state.count, shallow);",
  IMPORTS + "const user = useUserStore((state) => ({ name: state.name, age: state.age }), shallow);",
  IMPORTS + "const [name, age] = useUserStore((state) => [state.name, state.age], shallow);",
  IMPORTS + "const count = useUserStore(selectCount, shallow);", // 이름 있는 selector

  // shallow import alias / namespace import
  STORE + 'import { shallow as compare } from "zustand/shallow"; useUserStore((state) => state.count, compare);',
  STORE + 'import * as zs from "zustand/shallow"; useUserStore((state) => state.count, zs.shallow);',

  // 컴포넌트 안에서 사용
  IMPORTS + "function Profile() { const name = useUserStore((s) => s.name, shallow); return <div>{name}</div>; }",

  // 훅 호출이 아닌 정적 API
  IMPORTS + "const count = useUserStore.getState().count;",
  IMPORTS + "useUserStore.setState({ count: 1 });",
  IMPORTS + "const unsubscribe = useUserStore.subscribe((state) => console.log(state));",
  IMPORTS + "useUserStore.destroy();",
  LOCAL_STORE + "useProductStore.getState(); useProductStore.setState({ products: [] }); useProductStore.subscribe(() => {});",

  // 스토어를 값으로 전달 / 참조만 하는 경우
  IMPORTS + 'import { useStore } from "zustand"; const count = useStore(useUserStore, (s) => s.count);',
  IMPORTS + "const store = useUserStore; export { useUserStore };",

  // Zustand 가 아닌 Hook
  'import { useUserQuery } from "./api"; const data = useUserQuery();',
  "function useCustomStore(callback) { return callback(); }\nuseCustomStore((state) => state.value);",
  "const useFakeStore = makeHook(); useFakeStore((s) => s.value);", // create() 로 만들지 않은 로컬 변수
  "useUserStore((s) => s.count);", // 선언/import 를 확인할 수 없는 전역
  'import { create } from "./factory"; const useUserStore = create(() => ({})); useUserStore((s) => s.count);',
  {
    // zustand 패키지 자체의 useStore 는 이름이 패턴과 일치해도 스토어 훅이 아님
    code: 'import { useStore } from "zustand"; const count = useStore(api, (s) => s.count);',
    options: [{ storePattern: "^use[A-Za-z0-9]*Store$" }],
  },

  // 같은 파일에서 선언한 스토어
  LOCAL_STORE + SHALLOW + "const products = useProductStore((s) => s.products, shallow);",
  'import { create } from "zustand";\n' + SHALLOW + "function C() { return useBadName((s) => s.a, shallow); }\nconst useBadName = create(() => ({}));",

  // 인자를 정적으로 알 수 없는 경우
  IMPORTS + "useUserStore(...args);",

  // allowNoSelector
  { code: IMPORTS + "const state = useUserStore();", options: [{ allowNoSelector: true }] },
  { code: LOCAL_STORE + "const state = useProductStore();", options: [{ allowNoSelector: true }] },

  // 커스텀 패턴: 패턴과 일치하지 않는 import 는 검사하지 않음
  {
    code: IMPORTS + "const count = useUserStore((s) => s.count);",
    options: [{ storePattern: "^use[A-Z][A-Za-z0-9]*Model$" }],
  },
];

// ---------------------------------------------------------------------------
// 오류 사례
// ---------------------------------------------------------------------------

const invalid: RuleTester.InvalidTestCase[] = [
  // shallow 누락: 단일 원시값 / 객체 / 배열
  { code: IMPORTS + "const count = useUserStore((state) => state.count);", errors: [missingShallow()] },
  {
    code: IMPORTS + "const user = useUserStore((state) => ({ name: state.name, age: state.age }));",
    errors: [missingShallow()],
  },
  {
    code: IMPORTS + "const [name, age] = useUserStore((state) => [state.name, state.age]);",
    errors: [missingShallow()],
  },

  // selector 없이 전체 구독
  { code: IMPORTS + "const state = useUserStore();", errors: [missingSelector()] },
  {
    code: IMPORTS + "const state = useUserStore();",
    options: [{ allowNoSelector: false }],
    errors: [missingSelector()],
  },

  // 두 번째 인자가 zustand/shallow 의 shallow 가 아님
  {
    code: IMPORTS + "useUserStore((s) => s.count, Object.is);",
    errors: [invalidEqualityFn("Object.is")],
  },
  {
    code: IMPORTS + "useUserStore((s) => s.count, (a, b) => a === b);",
    errors: [invalidEqualityFn("(a, b) => a === b")],
  },
  {
    code: IMPORTS + 'import isEqual from "lodash/isEqual"; useUserStore((s) => s.user, isEqual);',
    errors: [invalidEqualityFn("isEqual")],
  },
  {
    code: STORE + "function shallow(a, b) { return a === b; }\nuseUserStore((s) => s.count, shallow);",
    errors: [invalidEqualityFn("shallow")],
  },
  {
    code: STORE + 'import { shallow } from "./utils/shallow"; useUserStore((s) => s.count, shallow);',
    errors: [invalidEqualityFn("shallow")],
  },
  {
    // v4 에서 deprecated 된 기본 import 는 허용하지 않음
    code: STORE + 'import shallow from "zustand/shallow"; useUserStore((s) => s.count, shallow);',
    errors: [invalidEqualityFn("shallow")],
  },
  {
    // import 한 shallow 를 같은 이름의 로컬 변수가 가린 경우
    code: IMPORTS + "function C() { const shallow = (a, b) => a === b; return useUserStore((s) => s.a, shallow); }",
    errors: [invalidEqualityFn("shallow")],
  },
  {
    // useShallow 는 초기 버전에서 허용하지 않음
    code: STORE + 'import { useShallow } from "zustand/shallow"; useUserStore(useShallow((s) => ({ a: s.a })));',
    errors: [missingShallow()],
  },

  // import alias: 원래 export 이름 또는 로컬 이름이 패턴과 일치하면 검사
  {
    code: 'import { useUserStore as useUsers } from "./stores"; useUsers((s) => s.count);',
    errors: [missingShallow("useUsers")],
  },
  {
    code: 'import useUserStore from "./stores/user"; useUserStore((s) => s.count);',
    errors: [missingShallow()],
  },

  // 같은 파일에서 create() 로 선언한 스토어 (이름이 패턴과 달라도 검사)
  { code: LOCAL_STORE + "useProductStore((s) => s.products);", errors: [missingShallow("useProductStore")] },
  {
    code: 'import { create } from "zustand";\nconst userStore = create(() => ({}));\nuserStore((s) => s.count);',
    errors: [missingShallow("userStore")],
  },
  {
    // 선언보다 먼저 나오는 컴포넌트에서의 사용
    code: 'import { create } from "zustand";\nfunction C() { return useCartStore(); }\nconst useCartStore = create(() => ({}));',
    errors: [missingSelector("useCartStore")],
  },

  // 여러 스토어가 같은 파일에 존재
  {
    code:
      IMPORTS +
      LOCAL_STORE +
      'import { useCartStore } from "./cart";\n' +
      "function C() {\n" +
      "  const name = useUserStore((s) => s.name, shallow);\n" +
      "  const products = useProductStore((s) => s.products);\n" +
      "  const items = useCartStore();\n" +
      "  const count = useUserStore((s) => s.count, Object.is);\n" +
      "}",
    errors: [
      missingShallow("useProductStore"),
      missingSelector("useCartStore"),
      invalidEqualityFn("Object.is"),
    ],
  },

  // 오류 위치: 호출식 / 잘못된 두 번째 인자
  {
    code: IMPORTS + "const count = useUserStore((s) => s.count);",
    errors: [{ ...missingShallow(), line: 3, column: 15 }],
  },
  {
    code: IMPORTS + "const count = useUserStore((s) => s.count, Object.is);",
    errors: [{ ...invalidEqualityFn("Object.is"), line: 3, column: 44 }],
  },

  // 커스텀 패턴
  {
    code: 'import { useUserModel } from "./models"; useUserModel((s) => s.count);',
    options: [{ storePattern: "^use[A-Z][A-Za-z0-9]*Model$" }],
    errors: [missingShallow("useUserModel")],
  },
];

// ---------------------------------------------------------------------------
// 실행: espree(JSX) / @typescript-eslint/parser(TSX) / babel-eslint
// ---------------------------------------------------------------------------

const parserOptions: Linter.ParserOptions = { ecmaVersion: 2020, sourceType: "module", ecmaFeatures: { jsx: true } };

describe("zustand-require-shallow", () => {
  describe("espree (JSX)", () => {
    new RuleTester({ parserOptions }).run("zustand-require-shallow", rule, { valid, invalid });
  });

  describe("@typescript-eslint/parser (TSX)", () => {
    const tester = new RuleTester({
      parser: require.resolve("@typescript-eslint/parser"),
      parserOptions,
    });

    tester.run("zustand-require-shallow", rule, { valid, invalid });

    tester.run("zustand-require-shallow (TS syntax)", rule, {
      valid: [
        IMPORTS + "const count = useUserStore((state: UserState) => state.count, shallow);",
        IMPORTS + "const count = useUserStore((state) => state.count, shallow as any);",
        IMPORTS + "type Store = typeof useUserStore; type S = ReturnType<typeof useUserStore.getState>;",
        'import type { useUserStore } from "./stores"; useUserStore((s) => s.count);', // 타입 전용 import
        'import { create } from "zustand";\n' +
          SHALLOW +
          "const useCountStore = create<CountState>()((set) => ({ count: 0 }));\n" +
          "const count = useCountStore((s) => s.count, shallow);",
      ],
      invalid: [
        {
          code: IMPORTS + "const count = useUserStore((state: UserState) => state.count);",
          errors: [missingShallow()],
        },
        {
          code:
            'import { create } from "zustand";\n' +
            "const useCountStore = create<CountState>()((set) => ({ count: 0 }));\n" +
            "const count = useCountStore((s) => s.count);",
          errors: [missingShallow("useCountStore")],
        },
        {
          code: IMPORTS + "const count = useUserStore((state) => state.count, shallowEqual as typeof shallow);",
          errors: [invalidEqualityFn("shallowEqual as typeof shallow")],
        },
      ],
    });
  });

  describe("babel-eslint", () => {
    new RuleTester({ parser: require.resolve("babel-eslint"), parserOptions }).run(
      "zustand-require-shallow",
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
          rules: { "custom-rule/zustand-require-shallow": ["warn", ...options] } as Linter.RulesRecord,
        },
      });
      const [result] = await eslint.lintText(IMPORTS + "useUserStore((s) => s.count);");
      return result.messages;
    }

    it("accepts no options and valid options", async () => {
      const optionSets = [[], [{}], [{ storePattern: "^use[A-Z][A-Za-z0-9]*Store$", allowNoSelector: false }]];
      for (const options of optionSets) {
        const messages = await lintWith(options);
        assert.deepStrictEqual(
          messages.map((m) => m.ruleId),
          ["custom-rule/zustand-require-shallow"]
        );
      }
    });

    const invalidConfigs = {
      "invalid regex storePattern": [{ storePattern: "use(" }],
      "empty storePattern": [{ storePattern: "" }],
      "non-boolean allowNoSelector": [{ allowNoSelector: "yes" }],
      "unknown property": [{ pattern: "^use" }],
    };

    Object.entries(invalidConfigs).forEach(([title, options]) => {
      it(`rejects ${title}`, async () => {
        await assert.rejects(
          () => lintWith(options),
          /Configuration for rule "custom-rule\/zustand-require-shallow" is invalid/
        );
      });
    });
  });

  describe("스키마 검증을 거치지 않는 직접 호출 (Linter)", () => {
    const linter = new Linter();
    linter.defineRule("zustand-require-shallow", rule);

    const badOptions: unknown[][] = [[{ storePattern: "use(" }], [{ storePattern: 1, allowNoSelector: "yes" }]];
    badOptions.forEach((options) => {
      it(`falls back to defaults with ${JSON.stringify(options)}`, () => {
        const messages = linter.verify(IMPORTS + "useUserStore();", {
          parserOptions,
          rules: { "zustand-require-shallow": ["warn", ...options] } as Linter.RulesRecord,
        });
        assert.deepStrictEqual(
          messages.map((m) => m.ruleId),
          ["zustand-require-shallow"]
        );
      });
    });
  });

  describe("파일 단위 분석", () => {
    it("does not leak import analysis between files", () => {
      const linter = new Linter();
      linter.defineRule("zustand-require-shallow", rule);
      const config = { parserOptions, rules: { "zustand-require-shallow": "warn" } } as Linter.Config;

      const withShallow = linter.verify(IMPORTS + "useUserStore((s) => s.a, shallow);", config);
      // 앞 파일의 shallow import 가 다음 파일에 영향을 주지 않는다
      const localShallow = linter.verify(
        STORE + "const shallow = (a, b) => a === b; useUserStore((s) => s.a, shallow);",
        config
      );

      assert.deepStrictEqual(withShallow, []);
      assert.deepStrictEqual(
        localShallow.map((m) => m.messageId),
        ["invalidEqualityFn"]
      );
    });
  });
});
