import { Linter, RuleTester } from "eslint";
import rule from "../../../lib/rules/no-korean-literal-in-jsx";

const MESSAGE_ID = "noKoreanLiteral";

/** 오류 위치 헬퍼: (line, column, endLine, endColumn) */
function at(
  line: number,
  column: number,
  endLine?: number,
  endColumn?: number
): RuleTester.TestCaseError {
  const error: RuleTester.TestCaseError = { messageId: MESSAGE_ID, line, column };
  if (endLine !== undefined) {
    error.endLine = endLine;
    error.endColumn = endColumn;
  }
  return error;
}

const valid: Array<string | RuleTester.ValidTestCase> = [
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

  // 번역 함수 호출이 렌더링 경로(조건식/논리식/템플릿/연결/배열/메서드 체인) 안에 있는 경우
  '<div>{cond ? t("활성") : t("비활성")}</div>',
  '<div>{name || t("이름 없음")}</div>',
  '<div>{name ?? t("없음")}</div>',
  '<div>{isActive && t("활성")}</div>',
  '<div>{`${t("안녕하세요")}, ${name}`}</div>',
  '<div>{t("안녕") + name}</div>',
  '<div>{[t("사과"), t("바나나")].join(", ")}</div>',
  '<div>{t("안녕").toUpperCase()}</div>',
  '<input placeholder={isNew ? t("새 글") : t("수정")} />',

  // 번역 함수 호출 형태 변형
  '<div>{t("welcome", { name: "홍길동" })}</div>', // 보간 옵션
  '<div>{t("save", "저장")}</div>', // 기본값 인수
  '<div>{t(isNew ? "새 글" : "수정")}</div>', // 인수 내부의 조건식
  '<div>{t?.("안녕")}</div>', // optional call
  '<div>{i18n?.t("안녕")}</div>',
  "<div>{t`안녕하세요`}</div>", // tagged template
  '<div>{intl.formatMessage({ id: "hello", defaultMessage: "안녕하세요" })}</div>',
  'function C() { const { t } = useTranslation(); return <div title={t("제목")}>{t("본문")}</div>; }',

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
  // 기본값: 이름이 key 로 끝나는 속성(번역 키 / React key)은 허용
  '<Trans i18nKey="안녕하세요" />',
  '<Button labelKey="저장" />',
  '<Field titleKey={"이름"} placeholderKey={isNew ? "새 글" : "수정"} />',
  '<div data-i18n-key="안녕" />',
  '<li key="항목">{t("item")}</li>',
  {
    code: '<Button titleKey="저장" data-testid="테스트" />',
    options: [{ ignoreAttributes: ["data-testid"] }], // 다른 옵션만 지정해도 기본 패턴 유지
  },
  // 사용자 지정 패턴
  {
    code: '<Button labelCode="저장" />',
    options: [{ ignoreAttributePatterns: ["Code$"] }],
  },
  // react-intl 의 defaultMessage 처럼 번역 원문을 담는 속성은 옵션으로 허용
  {
    code: '<FormattedMessage id="hello" defaultMessage="안녕하세요" />',
    options: [{ ignoreAttributes: ["defaultMessage"] }],
  },

  // 한글이 없는 문자열 (한자 / 일본어 / 전각 기호)
  "<div>漢字 カタカナ ＡＢＣ</div>",
];

const invalid: RuleTester.InvalidTestCase[] = [
  // 한글 JSXText
  { code: "<div>안녕하세요</div>", errors: [at(1, 6, 1, 11)] },
  { code: "<>안녕</>", errors: [at(1, 3, 1, 5)] },

  // 자모만 있는 문자열 (자음 / 모음 / 옛 자모 / NFD 로 분해된 한글)
  { code: "<div>ㅋㅋ</div>", errors: [at(1, 6, 1, 8)] },
  { code: "<div>ㅏㅏ</div>", errors: [at(1, 6, 1, 8)] },
  { code: "<div>ok ㄱ</div>", errors: [at(1, 6, 1, 10)] },
  { code: "<div>ㆍ</div>", errors: [at(1, 6, 1, 7)] },
  { code: "<div>\u1112\u1161\u11ab</div>", errors: [at(1, 6, 1, 9)] },
  { code: '<button title="ㅠㅠ" />', errors: [at(1, 15, 1, 19)] },
  { code: '<div>{"ㅎㅇ"}</div>', errors: [at(1, 7, 1, 11)] },
  { code: "<div>{`ㅋ ${name}`}</div>", errors: [at(1, 7)] },
  { code: '<div>{isActive ? "ㅇㅇ" : "ㄴㄴ"}</div>', errors: [at(1, 18), at(1, 25)] },

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

  // 번역 함수와 하드코딩 문자열이 섞인 경우: 번역 함수 쪽은 허용, 하드코딩 쪽만 보고
  { code: '<div>{cond ? t("가") : "나"}</div>', errors: [at(1, 23, 1, 26)] },
  { code: '<div>{t("hello") + "님"}</div>', errors: [at(1, 20)] },
  { code: '<div>{t("hello")}님</div>', errors: [at(1, 18, 1, 19)] },
  { code: '<div>{`${t("hello")}님`}</div>', errors: [at(1, 7)] },
  { code: '<div>{[t("a"), "나"]}</div>', errors: [at(1, 16)] },
  { code: '<p title={t("x") || "제목 없음"} />', errors: [at(1, 21)] },

  // 컴포넌트 형태의 번역 API 는 기본적으로 일반 JSX 와 동일하게 검사된다
  { code: '<FormattedMessage id="hello" defaultMessage="안녕하세요" />', errors: [at(1, 45)] },
  { code: '<Trans i18nKey="hello">안녕하세요</Trans>', errors: [at(1, 24)] },

  // key 로 "끝나는" 속성만 허용: 접두사/중간 일치는 검사
  { code: '<input keyword="검색어" />', errors: [at(1, 16)] },
  { code: '<Button title="저장" titleKey="저장" />', errors: [at(1, 15)] },
  // 속성을 허용해도 자식 텍스트는 계속 검사
  { code: '<Trans i18nKey="안녕">안녕하세요</Trans>', errors: [at(1, 21, 1, 26)] },
  // ignoreAttributePatterns 를 지정하면 기본 패턴을 대체 (빈 배열이면 비활성화)
  {
    code: '<Trans i18nKey="안녕하세요" />',
    options: [{ ignoreAttributePatterns: [] }],
    errors: [at(1, 16)],
  },
  {
    code: '<button aria-label="닫기" titleKey="저장" />',
    options: [{ ignoreAttributePatterns: ["^aria-"] }],
    errors: [at(1, 34)],
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

const jsxParserOptions: Linter.ParserOptions = {
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
        '<div>{t<string>("안녕")}</div>', // 제네릭 호출
        '<input placeholder={t("이름") as string} />',
        '<div>{t("안녕")!}</div>',
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
