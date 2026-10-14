"use strict";

const assert = require("assert");
const path = require("path");
const { ESLint, Linter, RuleTester } = require("eslint");
const plugin = require("..");
const rule = require("../rules/require-format");

// ---------------------------------------------------------------------------
// 공통 설정 (README 의 예시 설정과 동일)
// ---------------------------------------------------------------------------

const OPTIONS = [
  {
    rules: [
      { pattern: "Count$", functions: ["formatCount", "formatNumber"], methods: ["toLocaleString"] },
      { pattern: "Date$", functions: ["formatDate", "formatTimezone"], methods: [] },
    ],
  },
];

const KINDS = {
  Count: { pattern: "Count$", allowed: "formatCount(), formatNumber(), .toLocaleString()" },
  Date: { pattern: "Date$", allowed: "formatDate(), formatTimezone()" },
};

/** 포맷되지 않은 값 오류. name 은 보고된 노드의 소스 텍스트 */
function unformatted(name, kind = "Count", column) {
  const error = {
    messageId: "unformatted",
    data: { name, formatter: "", ...KINDS[kind] },
  };
  if (column !== undefined) {
    error.column = column;
  }
  return error;
}

/** 허용되지 않은 포맷 함수/메서드를 통과한 값 오류 */
function invalidFormatter(name, formatter, kind = "Count") {
  return { messageId: "invalidFormatter", data: { name, formatter, ...KINDS[kind] } };
}

/** 모든 케이스에 공통 옵션 적용 */
function withOptions(cases) {
  return cases.map((testCase) =>
    typeof testCase === "string"
      ? { code: testCase, options: OPTIONS }
      : { options: OPTIONS, ...testCase }
  );
}

// ---------------------------------------------------------------------------
// 정상 사례
// ---------------------------------------------------------------------------

const valid = withOptions([
  // 일반 변수의 포맷 함수 호출
  "<div>{formatCount(userCount)}</div>",
  "<div>{formatNumber(userCount)}</div>",
  "<div>{formatDate(createdDate)}</div>",
  "<div>{formatTimezone(createdDate)}</div>",
  "<div>{utils.formatDate(createdDate)}</div>", // 멤버 형태로 호출한 포맷 함수

  // 일반 변수의 포맷 메서드 호출
  "<div>{userCount.toLocaleString()}</div>",
  "<div>{userCount.toLocaleString('ko-KR')}</div>",

  // 중첩 객체의 포맷
  "<div>{response.data.userCount.toLocaleString()}</div>",
  "<div>{formatDate(response.data.user.profile.createdDate)}</div>",
  "<div>{formatCount(response['data']['userCount'])}</div>",

  // Optional Chaining
  "<div>{response?.data?.userCount?.toLocaleString()}</div>",
  "<div>{formatDate(response?.data?.createdDate)}</div>",
  "<div>{formatCount?.(userCount)}</div>",

  // 계산식 전체 포맷
  "<div>{(userCount + additionalCount).toLocaleString()}</div>",
  "<div>{formatCount(userCount + additionalCount)}</div>",
  "<div>{formatCount(userCount) + formatCount(additionalCount)}</div>",
  "<div>{formatCount(userCount * 2 - additionalCount)}</div>",

  // 조건식 각 분기 포맷
  "<div>{isActive ? userCount.toLocaleString() : totalCount.toLocaleString()}</div>",
  "<div>{formatCount(isActive ? userCount : totalCount)}</div>",
  "<div>{formatCount(userCount ?? 0)}</div>",
  "<div>{isActive && formatCount(userCount)}</div>",

  // 템플릿 리터럴 내부 포맷
  "<div>{`총 ${userCount.toLocaleString()}개`}</div>",
  "<div>{`${formatDate(createdDate)} 작성`}</div>",

  // 검사 대상이 아닌 일반 변수
  "<div>{userName}</div>",
  "<div>{user.profile.name}</div>",
  "<div>{discount}</div>", // 정규식은 대소문자를 구분한다 (Count$)
  "<div>{labels[userCount]}</div>", // computed 키: 말단 이름을 정적으로 알 수 없음

  // JSX 외부에서 사용하는 변수
  "const total = userCount + additionalCount;",
  "if (createdDate > now) { notify(String(userCount)); }",
  "const label = `${userCount}개`; const el = <div>{label}</div>;",

  // 구조 분해 별칭 (초기 버전 허용)
  "const { userCount: value } = response.data; const el = <div>{value}</div>;",

  // JSX 이벤트 핸들러 내부의 일반 연산
  "<button onClick={() => setUserCount(userCount + 1)}>+</button>",
  "<input onChange={(e) => setCreatedDate(e.target.value)} />",
  "<button onClick={function () { log(userCount); }}>log</button>",

  // 렌더링되지 않는 위치
  "<div>{userCount > 0 ? 'many' : 'none'}</div>", // 조건식 test, 비교 결과(boolean)
  "<div>{userCount > 0 && <Badge />}</div>", // && 왼쪽은 렌더링 조건
  "<div>{!userCount}</div>",
  "<div>{typeof createdDate}</div>",
  "<Badge count={userCount} />", // 컴포넌트 props 는 기본 검사 대상 아님
  "<DatePicker selected={createdDate} />",
  "<li key={createdDate}>{title}</li>",
  "<div>{/* userCount */}</div>",

  // 콜백을 받는 호출의 결과는 콜백이 만든다
  "<ul>{list.slice(0, visibleCount).map((item) => <li key={item.id}>{item.name}</li>)}</ul>",
  "<div>{[...Array(pageCount)].map((_, i) => <a key={i} />)}</div>",
  "<ul>{users.map((u) => <li key={u.id}>{formatCount(u.postCount)}</li>)}</ul>",

  // 텍스트로 보이는 속성은 포맷하면 정상
  "<span title={formatCount(userCount)} />",
]).concat([
  // 설정에서 여러 함수와 메서드를 허용하는 경우
  ...[
    "<div>{formatPrice(totalPrice)}</div>",
    "<div>{formatCurrency(totalPrice)}</div>",
    "<div>{totalPrice.toFixed(2)}</div>",
    "<div>{totalPrice.toLocaleString()}</div>",
    "<div>{currency.formatPrice(totalPrice)}</div>",
  ].map((code) => ({
    code,
    options: [
      {
        rules: [
          {
            pattern: "Price$",
            functions: ["formatPrice", "formatCurrency"],
            methods: ["toFixed", "toLocaleString"],
          },
        ],
      },
    ],
  })),

  // functions / methods 생략
  { code: "<div>{formatCount(userCount)}</div>", options: [{ rules: [{ pattern: "Count$", functions: ["formatCount"] }] }] },
  { code: "<div>{createdDate.toISOString()}</div>", options: [{ rules: [{ pattern: "Date$", methods: ["toISOString"] }] }] },

  // attributes 옵션: 지정하면 기본 목록을 대체
  { code: "<span title={userCount} />", options: [{ ...OPTIONS[0], attributes: ["label"] }] },
]);

// ---------------------------------------------------------------------------
// 오류 사례 (오류 개수와 보고된 값을 모두 검증)
// ---------------------------------------------------------------------------

const invalid = withOptions([
  // 포맷되지 않은 일반 변수
  { code: "<div>{userCount}</div>", errors: [unformatted("userCount", "Count", 7)] },
  { code: "<div>{createdDate}</div>", errors: [unformatted("createdDate", "Date", 7)] },

  // 포맷되지 않은 객체 필드
  { code: "<div>{user.userCount}</div>", errors: [unformatted("user.userCount", "Count", 7)] },
  { code: "<div>{this.createdDate}</div>", errors: [unformatted("this.createdDate", "Date")] },

  // 포맷되지 않은 중첩 객체 필드
  { code: "<div>{response.data.userCount}</div>", errors: [unformatted("response.data.userCount")] },
  {
    code: "<div>{response.data.user.profile.createdDate}</div>",
    errors: [unformatted("response.data.user.profile.createdDate", "Date")],
  },
  { code: "<div>{response['data']['userCount']}</div>", errors: [unformatted("response['data']['userCount']")] },
  { code: "<div>{response?.data?.userCount}</div>", errors: [unformatted("response?.data?.userCount")] },

  // 구조 분해로 선언된 변수
  {
    code: "const { userCount, createdDate } = response.data;\nconst el = <div>{userCount}{createdDate}</div>;",
    errors: [unformatted("userCount"), unformatted("createdDate", "Date")],
  },

  // 허용되지 않은 함수 사용
  { code: "<div>{String(userCount)}</div>", errors: [invalidFormatter("userCount", "String")] },
  { code: "<div>{unknownFunction(userCount)}</div>", errors: [invalidFormatter("userCount", "unknownFunction")] },
  { code: "<div>{new Date(createdDate)}</div>", errors: [invalidFormatter("createdDate", "Date", "Date")] },

  // 허용되지 않은 메서드 사용
  { code: "<div>{userCount.toString()}</div>", errors: [invalidFormatter("userCount", "toString")] },
  { code: "<div>{createdDate.toLocaleString()}</div>", errors: [invalidFormatter("createdDate", "toLocaleString", "Date")] },
  { code: "<div>{response?.data?.userCount?.toFixed(0)}</div>", errors: [invalidFormatter("response?.data?.userCount", "toFixed")] },

  // 다른 타입의 이름 패턴에 해당하는 포맷 함수 사용
  { code: "<div>{formatDate(userCount)}</div>", errors: [invalidFormatter("userCount", "formatDate")] },
  { code: "<div>{formatCount(createdDate)}</div>", errors: [invalidFormatter("createdDate", "formatCount", "Date")] },
  {
    code: "<div>{formatCount(isActive ? userCount : createdDate)}</div>",
    errors: [invalidFormatter("createdDate", "formatCount", "Date")],
  },

  // 포맷 함수로 감싼 부분과 감싸지 않은 부분이 섞인 계산식
  { code: "<div>{formatCount(otherValue) + userCount}</div>", errors: [unformatted("userCount", "Count", 33)] },
  { code: "<div>{userCount.toLocaleString() + additionalCount}</div>", errors: [unformatted("additionalCount", "Count", 36)] },
  {
    code: "<div>{(userCount + additionalCount).toFixed(0)}</div>",
    errors: [invalidFormatter("userCount", "toFixed"), invalidFormatter("additionalCount", "toFixed")],
  },

  // 조건식 / 논리식 일부 분기만 포맷
  {
    code: "<div>{isActive ? userCount.toLocaleString() : totalCount}</div>",
    errors: [unformatted("totalCount", "Count", 47)],
  },
  {
    code: "<div>{isActive ? userCount : totalCount}</div>",
    errors: [unformatted("userCount", "Count", 18), unformatted("totalCount", "Count", 30)],
  },
  { code: "<div>{userCount || 0}</div>", errors: [unformatted("userCount")] },
  { code: "<div>{userCount ?? '-'}</div>", errors: [unformatted("userCount")] },
  { code: "<div>{isActive && userCount}</div>", errors: [unformatted("userCount")] },

  // 템플릿 리터럴 내부의 미포맷 변수
  { code: "<div>{`총 ${userCount}개`}</div>", errors: [unformatted("userCount", "Count", 12)] },

  // 여러 미포맷 변수가 포함된 표현식
  {
    code: "<div>{userCount + additionalCount}</div>",
    errors: [unformatted("userCount"), unformatted("additionalCount")],
  },
  {
    code: "<div>{`${userCount} / ${totalCount} (${createdDate})`}</div>",
    errors: [unformatted("userCount"), unformatted("totalCount"), unformatted("createdDate", "Date")],
  },
  {
    code: "<div>{[userCount, '명', formatCount(totalCount), -additionalCount]}</div>",
    errors: [unformatted("userCount"), unformatted("additionalCount")],
  },

  // 중첩 JSX — 각 JSXExpressionContainer 에서 한 번씩만 보고
  {
    code: "<ul>{users.map((u) => <li key={u.id}>{u.postCount}</li>)}</ul>",
    errors: [unformatted("u.postCount")],
  },
  {
    code: "<div>{ok ? <b>{userCount}</b> : createdDate}</div>",
    errors: [unformatted("userCount"), unformatted("createdDate", "Date")],
  },

  // 텍스트로 보이는 기본 속성 (title, alt, aria-label, placeholder)
  { code: "<span title={userCount} />", errors: [unformatted("userCount")] },
  { code: "<img alt={`${createdDate}`} />", errors: [unformatted("createdDate", "Date")] },
]).concat([
  // attributes 옵션으로 컴포넌트 prop 을 검사 대상에 추가
  {
    code: "<Badge label={userCount} count={userCount} />",
    options: [{ ...OPTIONS[0], attributes: ["label"] }],
    errors: [unformatted("userCount", "Count", 15)],
  },
  // 허용 포맷이 없는 rule 의 메시지
  {
    code: "<div>{createdDate}</div>",
    options: [{ rules: [{ pattern: "Date$" }] }],
    errors: [{ messageId: "unformatted", data: { name: "createdDate", formatter: "", pattern: "Date$", allowed: "없음" } }],
  },
]);

// ---------------------------------------------------------------------------
// 실행: espree(JSX) / @typescript-eslint/parser(TSX) / babel-eslint / Babel Optional* AST
// ---------------------------------------------------------------------------

const parserOptions = { ecmaVersion: 2020, sourceType: "module", ecmaFeatures: { jsx: true } };

describe("require-format", () => {
  describe("espree (JSX)", () => {
    new RuleTester({ parserOptions }).run("require-format", rule, { valid, invalid });
  });

  describe("@typescript-eslint/parser (TSX)", () => {
    const tester = new RuleTester({
      parser: require.resolve("@typescript-eslint/parser"),
      parserOptions,
    });

    tester.run("require-format", rule, { valid, invalid });

    tester.run("require-format (TS syntax)", rule, {
      valid: withOptions([
        "<div>{(userCount as number).toLocaleString()}</div>",
        "<div>{userCount!.toLocaleString()}</div>",
        "<div>{formatCount(userCount satisfies number)}</div>",
        "<div>{formatDate(response.data!.createdDate)}</div>",
        "const userCount: number = 0; type CreatedDate = string;",
        "<Counter<number> value={userCount} />",
      ]),
      invalid: withOptions([
        { code: "<div>{userCount as number}</div>", errors: [unformatted("userCount")] },
        { code: "<div>{response.data!.userCount}</div>", errors: [unformatted("response.data!.userCount")] },
        { code: "<div>{createdDate satisfies string}</div>", errors: [unformatted("createdDate", "Date")] },
        {
          code: "<div>{(userCount as number).toFixed(0)}</div>",
          errors: [invalidFormatter("userCount", "toFixed")],
        },
      ]),
    });
  });

  describe("babel-eslint", () => {
    new RuleTester({ parser: require.resolve("babel-eslint"), parserOptions }).run(
      "require-format",
      rule,
      { valid, invalid }
    );
  });

  describe("Babel AST (OptionalMemberExpression / OptionalCallExpression)", () => {
    new RuleTester({
      parser: path.join(__dirname, "fixtures/babel-optional-parser.js"),
      parserOptions,
    }).run("require-format", rule, { valid, invalid });
  });

  describe("options schema (.eslintrc 설정 로딩 경로)", () => {
    // 일반적인 설정 로딩(ESLint 클래스 / CLI)에서는 meta.schema 로 옵션을 검증한다
    async function lintWith(options) {
      const eslint = new ESLint({
        useEslintrc: false,
        plugins: { "format-guard": plugin },
        overrideConfig: {
          parserOptions,
          plugins: ["format-guard"],
          rules: { "format-guard/require-format": ["error", ...options] },
        },
      });
      const [result] = await eslint.lintText("<div>{userCount}</div>");
      return result.messages;
    }

    it("accepts a valid configuration", async () => {
      const messages = await lintWith(OPTIONS);
      assert.deepStrictEqual(
        messages.map((m) => m.ruleId),
        ["format-guard/require-format"]
      );
    });

    const invalidConfigs = {
      "missing options": [],
      "missing rules": [{}],
      "empty rules": [{ rules: [] }],
      "missing pattern": [{ rules: [{ functions: ["formatCount"] }] }],
      "invalid regex pattern": [{ rules: [{ pattern: "Count(" }] }],
      "non-string function name": [{ rules: [{ pattern: "Count$", functions: [1] }] }],
      "unknown property": [{ rules: [{ pattern: "Count$", formatters: [] }] }],
    };

    Object.entries(invalidConfigs).forEach(([title, options]) => {
      it(`rejects ${title}`, async () => {
        await assert.rejects(
          () => lintWith(options),
          /Configuration for rule "format-guard\/require-format" is invalid/
        );
      });
    });
  });

  describe("스키마 검증을 거치지 않는 직접 호출 (Linter)", () => {
    const linter = new Linter();
    linter.defineRule("require-format", rule);

    // 잘못된 옵션이어도 ESLint 실행 중 예외를 던지지 않는다
    [[], [{}], [{ rules: [{ pattern: "Count(" }] }], [{ rules: [{ functions: ["x"] }] }]].forEach((options) => {
      it(`does not throw with ${JSON.stringify(options)}`, () => {
        const messages = linter.verify("<div>{userCount}</div>", {
          parserOptions,
          rules: { "require-format": ["error", ...options] },
        });
        assert.deepStrictEqual(messages, []);
      });
    });
  });
});
