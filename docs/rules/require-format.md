# require-format

JSX에서 **특정 이름 패턴을 가진 값**(예: `userCount`, `createdDate`)이 **포맷되지 않은 채 렌더링되는 것**을 막는 룰입니다. 자동 수정(fix)은 지원하지 않습니다.

```tsx
// ❌ 경고
<div>{userCount}</div>
<div>{createdDate}</div>

// ✅ 정상
<div>{userCount.toLocaleString()}</div>
<div>{formatCount(userCount)}</div>
<div>{formatDate(createdDate)}</div>
```

> **이 룰은 TypeScript 타입 분석이 아니라 "변수명 기반 컨벤션 검사"입니다.**
> 값의 실제 타입(`number`, `Date`)을 보지 않고, 변수명/필드명이 설정한 정규식과 일치하는지만 봅니다.
> TypeChecker, `parserOptions.project`를 사용하지 않으며 AST만으로 동작합니다.

## 설정 (`.eslintrc.json`)

```json
{
  "plugins": ["custom-rule"],
  "rules": {
    "custom-rule/require-format": [
      "warn",
      {
        "rules": [
          {
            "pattern": "Count$",
            "functions": ["formatCount", "formatNumber"],
            "methods": ["toLocaleString"]
          },
          {
            "pattern": "Date$",
            "functions": ["formatDate", "formatTimezone"],
            "methods": []
          }
        ]
      }
    ]
  }
}
```

기존 `plugins` / `rules`에 추가하면 됩니다. parser 등 다른 설정은 바꾸지 않아도 되고, 타입 정보(`parserOptions.project`)도 필요 없습니다.

## 옵션

| 옵션 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `rules` | `Rule[]` | ✅ | 검사 규칙 목록 (1개 이상) |
| `rules[].pattern` | `string` | ✅ | 변수명 또는 객체의 **말단 필드명**에 적용할 정규식. 대소문자를 구분함 |
| `rules[].functions` | `string[]` | | 값을 **인자로** 받는 허용 포맷 함수 이름. `formatCount(x)`, `utils.formatCount(x)` |
| `rules[].methods` | `string[]` | | 값에 **직접 호출하는** 허용 포맷 메서드 이름. `x.toLocaleString()` |
| `attributes` | `string[]` | | 검사할 JSX 속성 이름. 기본 `["title", "alt", "aria-label", "placeholder"]`. 지정하면 기본값을 대체 |

- 이름이 여러 `pattern`에 일치하면 **먼저 선언된 규칙**을 사용합니다.
- 설정은 `meta.schema`로 검증됩니다. `rules` 누락, 빈 배열, `pattern` 누락, **잘못된 정규식**, 알 수 없는 속성이 있으면 ESLint가 설정 오류를 냅니다.

### 오류 메시지

```
'userCount' 값은 포맷한 뒤 렌더링해야 합니다 (패턴: Count$, 허용: formatCount(), formatNumber(), .toLocaleString()).
'userCount' 값에 허용되지 않은 포맷 'formatDate'을(를) 사용했습니다 (패턴: Count$, 허용: formatCount(), formatNumber(), .toLocaleString()).
```

## 예제 (JSX / TSX 공통)

### ✅ 정상

```tsx
<div>{formatCount(userCount)}</div>                                   // 포맷 함수
<div>{userCount.toLocaleString()}</div>                               // 포맷 메서드
<div>{formatDate(response.data.user.profile.createdDate)}</div>       // 중첩 객체
<div>{response?.data?.userCount?.toLocaleString()}</div>              // optional chaining
<div>{(userCount + additionalCount).toLocaleString()}</div>           // 계산식 전체 포맷
<div>{formatCount(isActive ? userCount : totalCount)}</div>           // 조건식 전체 포맷
<div>{isActive ? userCount.toLocaleString() : formatCount(totalCount)}</div>
<div>{`총 ${userCount.toLocaleString()}개`}</div>                     // 템플릿 리터럴
<div>{userCount > 0 && <Badge />}</div>                               // && 왼쪽은 렌더링 조건
<button onClick={() => setUserCount(userCount + 1)}>+</button>        // 이벤트 핸들러
<Badge count={userCount} />                                           // 컴포넌트 props (기본 제외)
const total = userCount + 1;                                          // JSX 바깥
const { userCount: value } = data; <div>{value}</div>                 // 별칭 (추적 안 함)
<div>{(userCount as number).toLocaleString()}</div>                   // TS 래퍼
```

### ❌ 경고

```tsx
<div>{userCount}</div>
<div>{response.data.user.profile.createdDate}</div>
<div>{response?.data?.userCount}</div>
<div>{String(userCount)}</div>                        // 허용되지 않은 함수
<div>{userCount.toString()}</div>                     // 허용되지 않은 메서드
<div>{createdDate.toLocaleString()}</div>             // Date 규칙에는 허용되지 않은 메서드
<div>{formatDate(userCount)}</div>                    // 다른 패턴용 포맷 함수
<div>{formatCount(otherValue) + userCount}</div>      // 일부만 포맷
<div>{userCount.toLocaleString() + additionalCount}</div>
<div>{isActive ? userCount.toLocaleString() : totalCount}</div>
<div>{userCount || 0}</div>                           // || / ?? 왼쪽은 그대로 렌더링됨
<div>{`총 ${userCount}개`}</div>
<div>{userCount + additionalCount}</div>              // 2건
<span title={userCount} />                            // 텍스트 속성
```

전체 동작 예시는 [playground/FormatGuard.tsx](../../playground/FormatGuard.tsx)를 참고하세요 (`yarn playground`).

## 검사 원리 (AST)

ESLint는 소스 코드를 AST(추상 구문 트리)로 파싱하고, 룰이 등록한 노드 타입을 방문할 때 콜백을 호출합니다.
이 룰은 정규식으로 소스를 검색하지 않고, `JSXExpressionContainer` 노드 하나만 방문합니다.

1. **출력 위치 판별**: `{...}`가 JSX 자식이거나 `attributes`에 있는 속성값일 때만 검사합니다.
2. **값 흐름 추적 (`checkExpression`)**: 표현식에서 시작해, 최종 출력값에 그대로 흘러드는 값 참조를 찾습니다.

   | 노드 | 따라가는 위치 |
   | --- | --- |
   | `Identifier`, `MemberExpression`, `OptionalMemberExpression` | 이름(말단 필드명)이 `pattern`과 일치하면 **미포맷 값** |
   | `ConditionalExpression` | 두 분기 (조건 `test`는 제외) |
   | `LogicalExpression` | `\|\|`, `??`는 양쪽, `&&`는 오른쪽만 |
   | `BinaryExpression` | 산술/비트 연산만. 비교 연산은 boolean이라 제외 |
   | `UnaryExpression` | `-`, `+`, `~`만. `!`, `typeof` 제외 |
   | `TemplateLiteral`, `ArrayExpression`, `SequenceExpression`, `AwaitExpression` | 보간식 / 요소 / 마지막 식 / 인자 |
   | TS 래퍼 (`as`, `satisfies`, `!`), `ChainExpression` | 내부 식 |
   | 함수, 객체, 리터럴, 중첩 JSX 등 | 추적하지 않음 (중첩 JSX는 별도로 방문됨) |

3. **포맷 경계 (`isAllowedFormatter`)**: 호출식을 만나면 값이 호출의 **어느 위치에** 있는지 구분합니다.
   - `fn(value)`: 값이 **인수**로 전달됩니다. `fn`이 그 값의 규칙 `functions`에 있으면 포맷된 것으로 보고 결과에서 제외합니다.
   - `value.method()`: 값이 **수신 객체**입니다. `method`가 규칙 `methods`에 있으면 제외합니다.
   - 허용되지 않은 호출을 통과한 값은 경고 대상으로 남고, 메시지에 그 호출 이름이 표시됩니다.

   그래서 `formatCount(a) + b`에서는 `a`만 포맷된 것으로 처리되고 `b`는 경고됩니다.
   부모 중에 `CallExpression`이 있는지만 보는 방식이 아니라, **실제로 포맷 호출의 인수/수신 객체로 들어간 값**만 포맷된 것으로 봅니다.

4. **중복 방지**: 포맷된 하위 표현식은 결과에서 빠집니다. 같은 노드는 한 번만 보고합니다.

코드 구조:

```text
lib/rules/require-format.js     옵션/스키마, 출력 위치 판별, 보고
lib/utils/check-expression.js   checkExpression: 값 흐름 추적
lib/utils/formatter.js          isAllowedFormatter: 포맷터 식별 (이름 기반)
lib/utils/ast.js                파서별 AST 차이 흡수 (ChainExpression / Optional* 노드 등)
```

포맷터 식별은 `lib/utils/formatter.js`에 모여 있습니다. 나중에 import 경로/심볼 검증을 추가할 때(예: `formatDate`가 `@/utils/date`에서 import된 경우만 허용) 이 파일만 확장하면 됩니다.

## 제한사항

이름 기반 정적 검사이므로 다음은 정확히 분석하지 않습니다.

| 케이스 | 동작 | 이유 |
| --- | --- | --- |
| 변수 별칭 `const { userCount: value } = data; {value}` | 통과 | 별칭 추적 안 함 (이름이 패턴과 달라짐) |
| 함수 반환값 `{getUserCount()}` | 통과 | 반환값의 의미를 알 수 없음 |
| 콜백 반환값 `{users.map((u) => u.postCount)}` | 통과 | 콜백을 받는 호출의 결과는 추적하지 않음 (`[...Array(pageCount)].map(...)` 오탐 방지) |
| 메서드 인수 `{items.slice(0, visibleCount)}` | 통과 | 메서드 인수는 출력값이 아닌 경우가 많아 추적하지 않음 |
| import 심볼 | 이름만 비교 | 다른 모듈의 같은 이름 함수(`formatDate`)도 허용됨 |
| 실제 포맷 동작 | 분석 안 함 | `formatCount`가 정말 포맷하는지는 보지 않음 |
| 실제 타입 | 분석 안 함 | `userCount`가 문자열이어도 경고, 이름이 다르면 숫자여도 통과 |
| 컴포넌트 props `<Badge count={userCount} />` | 통과 | 컴포넌트가 포맷할 수 있음. 필요하면 `attributes`에 추가 |
| computed 키 `{data[key]}` | 통과 | 말단 이름을 정적으로 알 수 없음 |
