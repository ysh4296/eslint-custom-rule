# no-korean-literal-in-jsx

JSX에서 **직접 렌더링되는** 하드코딩 한글 문자열(`가-힣` 음절 포함)을 금지한다.
번역(i18n) 처리를 누락한 문자열을 개발 단계에서 찾기 위한 룰이다. 자동 수정(fix)은 지원하지 않는다.

> JSX 내부에 한글 문자열을 직접 작성할 수 없습니다. i18n 번역 함수를 사용하세요.

## 검사 방식

소스 정규식 검색이 아니라 AST Visitor 3개로 동작한다.

| Visitor | 대상 |
| --- | --- |
| `JSXText` | `<div>안녕</div>` — 앞뒤 공백을 제외한 텍스트 구간을 오류 위치로 보고 |
| `JSXAttribute` | 문자열 속성값 `title="저장"` (값이 `Literal`인 경우만) |
| `JSXExpressionContainer` | 자식 `{...}`과 속성 `attr={...}` 모두. 아래 "렌더링 경로"만 따라 내려감 |

`JSXExpressionContainer`의 렌더링 경로:

| 노드 | 검사 범위 |
| --- | --- |
| `Literal` (string) | 값 자체 |
| `TemplateLiteral` | 정적 구간(`TemplateElement`)에 한글이 있으면 1건 + `${}` 보간식 재귀 |
| `ConditionalExpression` | `consequent`, `alternate` (`test`는 제외) |
| `LogicalExpression` | `\|\|`, `??`: 양쪽 / `&&`: 오른쪽만 (한글 문자열은 항상 truthy라 왼쪽은 렌더링되지 않음) |
| `BinaryExpression` | `+`(문자열 연결)만 양쪽 |
| `ArrayExpression` | 각 요소 (spread 포함) |
| `CallExpression` | **인수는 검사하지 않음**. 메서드 호출의 수신 객체만 검사 (`["사과"].join()`, `"안녕".trim()`) |
| `SequenceExpression` | 마지막 식 |
| `TSAsExpression`, `TSSatisfiesExpression`, `TSNonNullExpression`, `TSTypeAssertion`, `ChainExpression` | 내부 식 |
| 그 외 (함수, 객체, 식별자, 멤버 접근, JSX 등) | 검사하지 않음. 중첩 JSX는 위 Visitor가 별도로 방문하므로 중복 보고 없음 |

타입 정보(`parserOptions.project`)는 사용하지 않는다. 문법(AST) 구조만으로 판단하므로 JS/JSX(espree)와 TS/TSX(`@typescript-eslint/parser`) 모두에서 동일하게 동작한다.

## 예시

❌ Incorrect

```tsx
<div>안녕하세요</div>
<input placeholder="이름을 입력하세요" />
<div>{"안녕하세요"}</div>
<div>{`안녕하세요 ${name}님`}</div>
<div>{isActive ? "활성" : "비활성"}</div>   // 2건
<div>{name || "이름 없음"}</div>
<div>{["사과", "바나나"].join(", ")}</div>  // 2건
<div>{"안녕" + name}</div>
```

✅ Correct

```tsx
const message = "안녕하세요";               // JSX 바깥
<div>{t("hello")}</div>
<div>{t("안녕하세요")}</div>                // 함수 인수
<div>{message}</div>
<div>{/* 한글 주석 */}</div>
<button onClick={() => alert("저장")} />  // 함수 본문은 렌더링 값이 아님
<div>{status === "완료" ? t("a") : t("b")}</div>
<div style={{ fontFamily: "맑은 고딕" }} />
<Trans i18nKey="안녕하세요" />             // 이름이 key 로 끝나는 속성
```

## 옵션

```js
"custom-rule/no-korean-literal-in-jsx": ["error", {
  ignoreAttributes: ["data-testid", "defaultMessage"],
  ignoreAttributePatterns: ["[Kk]ey$"], // 기본값
}]
```

- `ignoreAttributes` (`string[]`, 기본 `[]`): 검사하지 않을 JSX 속성 이름 (정확히 일치).
- `ignoreAttributePatterns` (`string[]`, 기본 `["[Kk]ey$"]`): 검사하지 않을 JSX 속성 이름의 정규식.
  - 기본값은 이름이 `key`로 끝나는 속성(`i18nKey`, `titleKey`, `data-i18n-key`, React `key`)을 허용한다. 번역 키나 React key는 렌더링 문자열이 아니기 때문이다.
  - 값을 지정하면 기본값을 **대체**한다. 기본 패턴을 유지하려면 `["[Kk]ey$", ...]`처럼 함께 적고, 끄려면 `[]`를 지정한다.
  - 문자열 속성값(`titleKey="저장"`)과 표현식 속성값(`titleKey={cond ? "가" : "나"}`) 모두에 적용된다.
  - 속성만 허용되고 자식은 계속 검사된다: `<Trans i18nKey="안녕">안녕하세요</Trans>`의 `안녕하세요`는 오류.

## 탐지하지 못하는 케이스

- **함수 호출 인수 전체 허용으로 인한 우회**: `{wrap("안녕")}`, `{String("안녕")}`, `{arr.join(" 그리고 ")}`의 구분자 등 번역 함수가 아닌 호출도 통과한다.
- **변수를 거친 문자열**: `const label = "저장"; <div>{label}</div>` — 스코프 추적을 하지 않는다.
- **콜백 반환값**: `{items.map(() => "항목")}`처럼 JSX가 아닌 문자열을 반환하는 콜백.
- **JSX 밖에서 만든 렌더링 데이터**: `const columns = [{ title: "이름" }]`처럼 props로 넘기는 설정 객체.
- **한글 자모/기타 문자**: `ㅋㅋ`, `ㄱ`처럼 음절이 아닌 자모만 있는 문자열.
