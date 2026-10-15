# no-unstable-hook-return

React 커스텀 훅(`use[A-Z]...`)이 **렌더링마다 새로 생성되는 함수를 반환하는 것**을 막는 룰입니다. 자동 수정(fix)은 지원하지 않습니다.

모든 함수에 `useCallback`을 강제하지 않습니다. **훅 안에서 새 함수를 만든다는 사실이 코드에 드러나는 경우만** 경고합니다.

```tsx
// ❌ 경고
function useCounter() {
  const increment = () => setCount((c) => c + 1);
  function reset() {}

  return {
    increment,              // 화살표 함수 변수
    reset,                  // 함수 선언문
    decrement: () => {},    // 인라인 함수
    toggle() {},            // 메서드
  };
}

// ✅ 정상
function useCounter() {
  const [count, setCount] = useState(0);
  const [state, dispatch] = useReducer(reducer, initialState);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  const handler = useMemo(() => () => {}, []);
  const { reset } = useAnotherHook();

  return { count, setCount, dispatch, increment, handler, reset, externalHandler };
}
```

> TypeChecker나 `parserOptions.project`를 사용하지 않고 **AST와 스코프 분석(eslint-scope)만으로** 동작합니다.

## 설정 (`.eslintrc.json`)

```json
{
  "plugins": ["custom-rule", "react-hooks"],
  "rules": {
    "custom-rule/no-unstable-hook-return": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

옵션은 없습니다. `useCallback` / `useMemo`의 의존성 배열 검사는 `react-hooks/exhaustive-deps`에 맡깁니다. 이 룰은 `react-hooks` 플러그인 없이도 동작합니다.

## 동작 원리

### 1. 커스텀 훅 인식

이름이 `^use[A-Z]`와 일치하는 함수만 검사합니다.

| 형태 | 인식 |
| --- | --- |
| `function useX() {}`, `export default function useX() {}` | ✅ |
| `const useX = () => {}`, `const useX = function () {}` | ✅ |
| `const useX = (() => {}) as UseX` | ✅ TS 래퍼 |
| `function Counter() {}`, `function useless() {}`, `function use() {}` | ❌ |
| `const useX = makeHook(() => {})` | ❌ 다른 함수로 감싼 경우 |

### 2. 반환 위치

함수 스택을 유지하면서, **가장 가까운 함수가 훅인 `return`만** 훅의 반환으로 봅니다. 그래서 `useEffect` 콜백, `map` 콜백, 중첩 함수의 `return`은 제외됩니다. 화살표 함수 훅의 식 본문(`const useX = () => value`)도 반환으로 봅니다.

반환 값은 다음 단위까지 펼쳐서 검사합니다.

| 반환 형태 | 검사 대상 |
| --- | --- |
| `return { a, b: x, c() {} }` | 각 프로퍼티 값, 메서드 |
| `return [a, b]` | 각 요소 |
| `return fn` / `return () => {}` | 값 자체 |
| `return cond ? { a } : [b]` | 두 분기를 각각 위 규칙으로 |
| `as`, `satisfies`, `!` | 내부 식 |

### 3. 값 판정

| 값 | 판정 |
| --- | --- |
| 인라인 함수 `() => {}`, `function () {}`, 메서드 | ❌ 경고 |
| `cond ? () => {} : externalHandler`, `a \|\| (() => {})`, `a ?? function () {}` | ❌ 어느 분기든 인라인 함수가 있으면 경고 |
| 훅 안에서 선언한 변수 | 아래 "변수 추적" |
| 함수 호출 결과 `useCallback()`, `useMemo()`, `getHandler()` | 검사하지 않음 |
| 구조 분해 `const [s, setS] = useState()`, `const { a } = useOther()` | 검사하지 않음 |
| 멤버 접근 `actions.increment`, 리터럴, JSX | 검사하지 않음 |

### 4. 변수 추적 (Scope API)

반환된 Identifier는 이름이 아니라 **스코프 체인의 실제 바인딩**으로 찾습니다. 같은 이름의 다른 변수(shadowing)와 구분됩니다.

1. 바인딩이 **훅 함수 자신의 실행 안**(훅 본문 또는 그 안의 블록)에서 선언된 경우만 검사합니다. 모듈 스코프, 바깥 함수 스코프, 선언되지 않은 전역은 제외합니다.
2. 다음 중 하나면 렌더링마다 새로 생성되는 함수로 판단합니다.
   - 함수 선언문 `function increment() {}`
   - `const x = 값` 또는 `x = 값`(재할당) 중 하나라도 위 3번 기준으로 인라인 함수일 수 있는 값을 대입
   - 같은 훅 안의 다른 새 함수 변수를 가리키는 별칭 `const handler = increment`
3. `useEffect` 콜백처럼 **중첩 함수 안에서 일어난 대입**은 실행 시점을 알 수 없으므로 보지 않습니다.

그래서 아래 코드는 `useCallback`으로 선언했어도 인라인 함수로 재할당되므로 경고합니다.

```tsx
function useCounter() {
  let handler = useCallback(() => {}, []);
  handler = () => {};
  return { handler }; // ❌
}
```

같은 변수는 여러 번 반환되어도 한 번만 보고합니다. 변수별 판정 결과는 `create()` 안의 `Map`에 캐싱되어 파일 검사가 끝나면 함께 해제됩니다.

### `useCallback` 등을 import로 식별하지 않는 이유

이 룰은 "새 함수를 만든다는 사실이 보이는 값"만 경고하고, 함수 호출 결과는 모두 판정하지 않습니다. 따라서 `useCallback(...)`, `memoFn(...)`(import alias), `React.useCallback(...)`, `useState`의 setter, `useReducer`의 dispatch는 어디서 import했는지와 관계없이 자연히 허용됩니다. React import를 따로 추적해도 판정 결과가 달라지는 경우가 없어서 추적하지 않습니다.

## 검사하지 않는 경우 (제한사항)

- **중첩 객체 / 배열**: `return { actions: { increment: () => {} } }`, `return [[() => {}]]`
- **spread**: `return { ...actions }`, `return [...handlers]`
- **함수 호출 결과**: `getHandler()`, `useAnotherHook()`이 돌려준 함수, `handler.bind(null)` (반환값의 안정성을 알 수 없음)
- **멤버 접근**: `const actions = { inc: () => {} }; return { inc: actions.inc }`
- **매개변수**: `function useX(callback) { return { callback }; }`
- **getter / setter**: `return { get value() {} }`
- **중첩 함수 안의 대입**: `useEffect(() => { handler = () => {}; })`
- **다른 함수로 감싸 만든 훅**: `const useX = makeHook(() => {...})`
- **다른 모듈의 함수 구현**: import한 함수가 실제로 안정적인지는 보지 않습니다.

## 예제

전체 사례는 [tests/lib/rules/no-unstable-hook-return.test.ts](../../tests/lib/rules/no-unstable-hook-return.test.ts)를 참고하세요.
