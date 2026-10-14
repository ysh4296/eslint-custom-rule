"use strict";

const { RuleTester } = require("eslint");
const rule = require("../../../lib/rules/no-korean-literal-in-jsx");

const MESSAGE_ID = "noKoreanLiteral";

/** 오류 위치 헬퍼: (line, column, endLine, endColumn) */
function at(line, column, endLine, endColumn) {
  const error = { messageId: MESSAGE_ID, line, column };
  if (endLine !== undefined) {
    error.endLine = endLine;
    error.endColumn = endColumn;
  }
  return error;
}

const valid = [
  // 영문 / 숫자 JSXText
  "<div>Hello World</div>",
  "<div>12345</div>",
  "<div>  {count} items  </div>",

  // 번역 함수 호출 / 변수 참조
  '<div>{t("hello")}</div>',
  '<button title={t("save")}>{t("save")}</button>',
  "<div>{message}</div>",
  "<span>{user.name}</span>",

  // 영문 JSXAttribute / 동적 속성
  '<input placeholder="Enter your name" />',
  '<input placeholder={t("name.placeholder")} />',
  "<input placeholder={placeholder} />",

  // JSX 바깥의 한글 문자열 / 객체 속성
  'const message = "안녕하세요";',
  'const user = { name: "홍길동" };',
  'function Component() { const label = "저장"; return <div>{label}</div>; }',
  'const map = { save: "저장" }; const el = <div>{map.save}</div>;',

  // JSX 내부 함수 호출의 한글 인수 (번역 함수 등)
  '<div>{t("안녕하세요")}</div>',
  '<div>{formatMessage("안녕하세요")}</div>',
  '<div>{i18n.t("안녕하세요")}</div>',
  '<input placeholder={t("이름을 입력하세요")} />',

  // JSX 주석 / 일반 코드 주석
  "<div>{/* 안녕하세요 */}</div>",
  "<div>\n  {/* 주석: 저장 버튼 */}\n  {t('save')}\n</div>",
  "<div>{message /* 한글 주석 */}</div>",
  "// 한글 주석\nconst el = <div>{message}</div>;",

  // 영문 Template Literal
  "<div>{`Hello ${name}`}</div>",

  // 빈 문자열
  '<div title="">{""}</div>',
  "<div>{``}</div>",

  // 중첩 JSX 의 정상적인 표현식
  "<ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>",
  '<div>{isOpen ? <Modal title={t("title")} /> : null}</div>',
  "<A><B><C>{t('deep')}</C></B></A>",

  // JSX 안에 선언한 함수의 일반 문자열 (렌더링 값이 아님)
  '<button onClick={() => alert("저장되었습니다")}>{t("save")}</button>',
  '<button onClick={function () { console.log("클릭"); }}>OK</button>',
  '<ul>{items.filter((i) => i.type === "과일").map((i) => <li>{i.name}</li>)}</ul>',

  // 렌더링되지 않는 위치의 한글
  '<div>{status === "완료" ? t("done") : t("pending")}</div>', // 조건식의 test
  '<div>{isActive && t("active")}</div>',
  '<div style={{ fontFamily: "맑은 고딕" }} />', // 객체 리터럴
  '<div>{"가나다".length}</div>', // 멤버 접근 결과는 렌더링 문자열이 아님

  // 옵션: ignoreAttributes
  {
    code: '<div data-testid="테스트">{t("x")}</div>',
    options: [{ ignoreAttributes: ["data-testid"] }],
  },
  {
    code: '<div data-testid={"테스트"} />',
    options: [{ ignoreAttributes: ["data-testid"] }],
  },

  // 정의상 한글 "음절"(가-힣)만 검사한다. 자모만 있는 문자열은 대상이 아님
  "<div>ㅋㅋ</div>",
];

const invalid = [
  // 한글 JSXText
  { code: "<div>안녕하세요</div>", errors: [at(1, 6, 1, 11)] },
  { code: "<>안녕</>", errors: [at(1, 3, 1, 5)] },

  // 한글 JSXAttribute (문자열 속성값)
  { code: '<input placeholder="이름을 입력하세요" />', errors: [at(1, 20, 1, 31)] },
  { code: '<button title="저장" />', errors: [at(1, 15, 1, 19)] },
  { code: "<img alt='프로필 이미지' />", errors: [at(1, 10)] },

  // 한글 JSXAttribute (표현식 속성값) — JSXExpressionContainer 쪽에서 1건만 보고
  { code: '<input placeholder={"이름"} />', errors: [at(1, 21, 1, 25)] },
  {
    code: '<input placeholder={isNew ? "새 글" : "수정"} />',
    errors: [at(1, 29), at(1, 37)],
  },

  // 한글 String Literal
  { code: '<div>{"안녕하세요"}</div>', errors: [at(1, 7, 1, 14)] },
  { code: "<div>{'안녕하세요'}</div>", errors: [at(1, 7, 1, 14)] },

  // 한글 Template Literal
  { code: "<div>{`안녕하세요`}</div>", errors: [at(1, 7, 1, 14)] },
  // 정적 구간 2곳에 한글이 있어도 TemplateLiteral 1건으로 보고
  { code: "<div>{`안녕하세요 ${name}님`}</div>", errors: [at(1, 7)] },
  // 보간식 내부의 렌더링 문자열도 검사
  {
    code: '<div>{`${a ? "가" : "나"} 입니다`}</div>',
    errors: [at(1, 7), at(1, 14), at(1, 20)],
  },

  // 삼항 연산자 양쪽
  {
    code: '<div>{isActive ? "활성" : "비활성"}</div>',
    errors: [at(1, 18, 1, 22), at(1, 25, 1, 30)],
  },

  // 논리 연산자
  { code: '<div>{name || "이름 없음"}</div>', errors: [at(1, 15)] },
  { code: '<div>{isActive && "활성"}</div>', errors: [at(1, 19)] },
  { code: '<div>{name ?? "없음"}</div>', errors: [at(1, 15)] },

  // 배열
  {
    code: '<div>{["사과", "바나나"].join(", ")}</div>',
    errors: [at(1, 8, 1, 12), at(1, 14, 1, 19)],
  },
  { code: '<div>{[...["가"], name]}</div>', errors: [at(1, 12)] },

  // 문자열 연결
  { code: '<div>{"안녕" + name}</div>', errors: [at(1, 7)] },
  { code: '<div>{name + "님"}</div>', errors: [at(1, 14)] },
  { code: '<div>{"안녕" + "하세요"}</div>', errors: [at(1, 7), at(1, 14)] },
  // 문자열 메서드 호출의 수신 객체
  { code: '<div>{"안녕".toUpperCase()}</div>', errors: [at(1, 7)] },

  // 중첩 JSX 내부
  { code: "<div><p><span>내부</span></p></div>", errors: [at(1, 15, 1, 17)] },
  {
    code: '<ul>{items.map((item) => <li>{item.done ? "완료" : item.name}</li>)}</ul>',
    errors: [at(1, 43)],
  },
  { code: "<div>{cond && <b>굵게</b>}</div>", errors: [at(1, 18, 1, 20)] },
  // 같은 표현식에 JSX 와 문자열이 섞여도 각각 1건씩만 보고 (중복 없음)
  {
    code: '<div>{ok ? <span>예</span> : "아니오"}</div>',
    errors: [at(1, 18), at(1, 29)],
  },

  // 한글 + 영어 혼합
  { code: "<div>저장 Save</div>", errors: [at(1, 6, 1, 13)] },
  { code: '<button title="Save 저장" />', errors: [at(1, 15)] },

  // 공백 / 줄바꿈 포함 — 위치는 앞뒤 공백을 제외한 실제 텍스트
  { code: "<div>\n  안녕하세요\n</div>", errors: [at(2, 3, 2, 8)] },
  { code: "<div>   저장  하기   </div>", errors: [at(1, 9, 1, 15)] },
  {
    code: "<p>\n  첫 번째 줄\n  두 번째 줄\n</p>",
    errors: [at(2, 3, 3, 9)],
  },

  // 동일 JSX 표현식에 한글 Literal 여러 개
  {
    code: '<div>{a ? "하나" : b ? "둘" : "셋"}</div>',
    errors: [at(1, 11), at(1, 22), at(1, 28)],
  },

  // 요구사항 1의 예시 컴포넌트
  {
    code: [
      "function Component() {",
      "  return (",
      "    <div>",
      "      안녕하세요",
      '      <button title="저장하기">저장</button>',
      '      <span>{"삭제"}</span>',
      "    </div>",
      "  );",
      "}",
    ].join("\n"),
    errors: [at(4, 7, 4, 12), at(5, 21, 5, 27), at(5, 28, 5, 30), at(6, 14, 6, 18)],
  },

  // 옵션: 무시하지 않은 속성은 계속 검사
  {
    code: '<div data-testid="테스트" title="제목" />',
    options: [{ ignoreAttributes: ["data-testid"] }],
    errors: [at(1, 30)],
  },
];

const jsxParserOptions = {
  ecmaVersion: 2020,
  sourceType: "module",
  ecmaFeatures: { jsx: true },
};

describe("no-korean-literal-in-jsx", () => {
  describe("espree (JSX)", () => {
    new RuleTester({ parserOptions: jsxParserOptions }).run(
      "no-korean-literal-in-jsx",
      rule,
      { valid, invalid }
    );
  });

  describe("@typescript-eslint/parser (TSX)", () => {
    const tsRuleTester = new RuleTester({
      parser: require.resolve("@typescript-eslint/parser"),
      parserOptions: jsxParserOptions,
    });

    // 공통 케이스를 TSX 파서로도 동일하게 검증
    tsRuleTester.run("no-korean-literal-in-jsx", rule, { valid, invalid });

    // TypeScript 전용 문법
    tsRuleTester.run("no-korean-literal-in-jsx (TS syntax)", rule, {
      valid: [
        'type Label = "저장" | "취소";',
        'const label: "저장" = "저장";',
        'enum Status { Done = "완료" }',
        '<Select<"저장" | "취소"> value={value} />', // 타입 인수의 문자열 리터럴 타입
        "<div>{label as string}</div>",
        "<div>{user!.name}</div>",
        'const C = (): JSX.Element => <div>{t("hello") satisfies string}</div>;',
        'function Generic<T>(props: { items: T[] }) { const empty = "없음"; return <ul>{props.items.length}</ul>; }',
      ],
      invalid: [
        { code: '<div>{"안녕" as string}</div>', errors: [at(1, 7, 1, 11)] },
        { code: '<div>{"안녕" satisfies string}</div>', errors: [at(1, 7)] },
        { code: '<div>{(name ?? "없음")!}</div>', errors: [at(1, 16)] },
        { code: '<Select<string> title="제목" />', errors: [at(1, 23)] },
        {
          code: 'const C: React.FC<Props> = ({ title }) => <h1>{title || "제목 없음"}</h1>;',
          errors: [at(1, 57)],
        },
      ],
    });
  });
});
