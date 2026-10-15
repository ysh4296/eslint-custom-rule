import { Linter, RuleTester } from "eslint";
import rule from "../../../lib/rules/no-unstable-hook-return";

/** `code` 안에서 `needle` 이 (nth 번째로) 시작하는 위치 */
function locate(code: string, needle: string, nth = 0): { line: number; column: number } {
  let index = -1;
  for (let i = 0; i <= nth; i += 1) {
    index = code.indexOf(needle, index + 1);
    if (index === -1) {
      throw new Error(`'${needle}' not found in:\n${code}`);
    }
  }
  const before = code.slice(0, index).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

interface ErrorSpec {
  error: RuleTester.TestCaseError;
  needle: string; // 오류가 시작해야 하는 코드 조각
  nth: number;
}

/** 이름이 있는 함수 (변수 / 프로퍼티) 반환 오류 */
function named(hook: string, name: string, needle: string, nth = 0): ErrorSpec {
  return { error: { messageId: "unstableReturn", data: { hook, name } }, needle, nth };
}

/** 이름 없는 인라인 함수 반환 오류 */
function inline(hook: string, needle: string, nth = 0): ErrorSpec {
  return { error: { messageId: "unstableInlineReturn", data: { hook } }, needle, nth };
}

/** 오류 위치(line / column)를 code 안의 needle 위치로 검증한다 */
function invalidCase(code: string, errors: ErrorSpec[]): RuleTester.InvalidTestCase {
  return {
    code,
    errors: errors.map(({ error, needle, nth }) => ({ ...error, ...locate(code, needle, nth) })),
  };
}

// ---------------------------------------------------------------------------
// 정상 사례
// ---------------------------------------------------------------------------

const valid: string[] = [
  // useCallback / useMemo
  "function useCounter() { const increment = useCallback(() => {}, []); return { increment }; }",
  'import { useCallback as memoFn } from "react"; function useHandler() { const handler = memoFn(() => {}, []); return { handler }; }',
  'import React from "react"; function useHandler() { const handler = React.useCallback(() => {}, []); return { handler }; }',
  'import * as React from "react"; function useHandler() { const handler = React.useCallback(() => {}, []); return [handler]; }',
  "function useHandler() { const handler = useMemo(() => () => {}, []); return { handler }; }",
  "function useHandler() { return useCallback(() => {}, []); }",
  "function useHandler() { const stable = useCallback(() => {}, []); const handler = stable; return { handler }; }",

  // useState setter / useReducer dispatch
  "function useCounter() { const [count, setCount] = useState(0); return { count, setCount }; }",
  "function useCounter() { const [state, dispatch] = useReducer(reducer, initialState); return { state, dispatch }; }",
  "function useCounter() { const [count, setCount] = useState(0); return [count, setCount]; }",

  // 모듈 스코프 함수
  "function externalHandler() {} function useHandler() { return { externalHandler }; }",
  "const externalHandler = () => {}; function useHandler() { return { externalHandler, other: externalHandler }; }",
  "const externalHandler = () => {}; function useHandler() { return externalHandler; }",

  // 일반 데이터
  "function useCounter() { const count = 0; const isLoading = false; return { count, isLoading }; }",
  "function useCounter() { const items = [1, 2]; const config = { a: 1 }; return [items, config, 'text', 1, null]; }",
  "function useCounter() { let handler; return { handler }; }",

  // 다른 훅 / 함수 호출에서 얻은 값 (안정성을 알 수 없음)
  "function useCounter() { const { increment } = useAnotherHook(); return { increment }; }",
  "function useCounter() { const actions = useAnotherHook(); return { increment: actions.increment }; }",
  "function useCounter() { const handler = getHandler(); return { handler }; }",
  "function externalHandler() {} function useCounter() { const handler = condition ? externalHandler : getHandler(); return { handler }; }",
  "function useCounter(callback) { return { callback }; }",
  "function useCounter({ onChange }) { return { onChange }; }",

  // 중첩 함수 / 콜백의 return 은 훅의 반환이 아님
  "function useCounter() { function helper() { return () => {}; } const list = [1].map(() => () => {}); return { value: 1 }; }",
  "function useCounter() { useEffect(() => { const listener = () => {}; return () => listener(); }, []); return { value: 1 }; }",
  "function useCounter() { const handler = useCallback(() => { return () => {}; }, []); return { handler }; }",

  // 바깥 함수 스코프의 함수 (훅 실행마다 만들어지지 않음)
  "function createHook() { const handler = () => {}; function useHandler() { return { handler }; } return useHandler; }",

  // 중첩 함수 안의 재할당은 보지 않는다
  "function useCounter() { let handler = useCallback(() => {}, []); useEffect(() => { handler = () => {}; }); return { handler }; }",

  // shadowing: 같은 이름이지만 다른 바인딩
  "function useCounter() { const handler = useCallback(() => {}, []); function inner() { const handler = () => {}; return handler; } return { handler }; }",
  "function increment() {} function useCounter() { { const increment = () => {}; } return { increment }; }",
  "function useCounter() { const handler = () => {}; { const handler = useCallback(() => {}, []); return { handler }; } }",

  // && 왼쪽은 함수일 수 없다
  "function useCounter() { const handler = () => {}; return { handler: enabled && externalHandler }; }",

  // 초기 버전에서 분석하지 않는 형태
  "function useCounter() { return { actions: { increment: () => {} } }; }",
  "function useCounter() { const actions = { increment: () => {} }; return { ...actions }; }",
  "function useCounter() { const handlers = [() => {}]; return [...handlers]; }",
  "function useCounter() { return { get value() { return 1; }, set value(v) {} }; }",
  "function useCounter() { const handler = () => {}; return { [key]: handler.bind(null) }; }",

  // 훅이 아닌 함수 / 컴포넌트
  "function Counter() { const onClick = () => {}; return { onClick }; }",
  "const Counter = () => { const handleClick = () => {}; return <button onClick={handleClick}>+</button>; };",
  "function useless() { return () => {}; }",
  "function use() { return () => {}; }",
  "function createCounter() { const increment = () => {}; return { increment }; }",
  "const useCounter = makeHook(() => { const increment = () => {}; return { increment }; });",

  // JSX 이벤트 핸들러는 반환 값이 아니다
  "function useButton() { return <button onClick={() => {}}>+</button>; }",
  "function useButton() { const handleClick = useCallback(() => {}, []); return { element: <button onClick={() => {}} />, handleClick }; }",
];

// ---------------------------------------------------------------------------
// 오류 사례
// ---------------------------------------------------------------------------

const invalid: RuleTester.InvalidTestCase[] = [
  // A. 화살표 함수 변수
  invalidCase(
    `function useCounter() {
  const increment = () => {
    console.log("increment");
  };

  return { increment };
}`,
    [named("useCounter", "increment", "increment }")]
  ),

  // B. 함수 선언문
  invalidCase(
    `function useCounter() {
  function increment() {
    console.log("increment");
  }

  return { increment };
}`,
    [named("useCounter", "increment", "increment }")]
  ),

  // C. 반환 객체의 인라인 함수 (화살표 함수 + 메서드)
  invalidCase(
    `function useCounter() {
  return {
    increment: () => {},
    decrement() {}
  };
}`,
    [
      named("useCounter", "increment", "() => {}"),
      named("useCounter", "decrement", "decrement() {}"),
    ]
  ),
  invalidCase(
    "function useCounter() { return { 'increment': function () {}, [\"reset\"]: async () => {}, [key]: () => {} }; }",
    [
      named("useCounter", "increment", "function () {}"),
      named("useCounter", "reset", "async () => {}"),
      inline("useCounter", "() => {} }"),
    ]
  ),

  // D. 배열 반환
  invalidCase(
    `function useCounter() {
  const increment = () => {};

  return [0, increment];
}`,
    [named("useCounter", "increment", "increment]")]
  ),
  invalidCase(
    "function useCounter() { const [count] = useState(0); return [count, () => {}, function () {}]; }",
    [inline("useCounter", "() => {}"), inline("useCounter", "function () {}")]
  ),

  // E. 함수 직접 반환
  invalidCase(
    `function useHandler() {
  return () => {};
}`,
    [inline("useHandler", "() => {}")]
  ),
  invalidCase("function useHandler() { return function () {}; }", [
    inline("useHandler", "function () {}"),
  ]),
  invalidCase("const useHandler = () => () => {};", [inline("useHandler", "() => {}")]),
  invalidCase("function useHandler() { const handler = () => {}; return handler; }", [
    named("useHandler", "handler", "handler; }"),
  ]),
  invalidCase("const useHandler = () => ({ handler: () => {} });", [
    named("useHandler", "handler", "() => {} }"),
  ]),

  // 훅 정의 형태: 화살표 함수 / 함수 표현식 / export
  invalidCase("const useCounter = () => { const increment = () => {}; return { increment }; };", [
    named("useCounter", "increment", "increment }"),
  ]),
  invalidCase("const useCounter = function () { const increment = function () {}; return { increment }; };", [
    named("useCounter", "increment", "increment }"),
  ]),
  invalidCase("export default function useCounter() { function reset() {} return { reset }; }", [
    named("useCounter", "reset", "reset }"),
  ]),
  invalidCase("export const useCounter = () => { const reset = () => {}; return { reset }; };", [
    named("useCounter", "reset", "reset }"),
  ]),

  // 조건식 안의 명확한 함수 생성
  invalidCase("function useCounter() { return { handler: condition ? () => {} : externalHandler }; }", [
    named("useCounter", "handler", "() => {}"),
  ]),
  invalidCase("function useCounter() { return { handler: externalHandler || (() => {}) }; }", [
    named("useCounter", "handler", "() => {}"),
  ]),
  invalidCase("function useCounter() { return { handler: externalHandler ?? function () {} }; }", [
    named("useCounter", "handler", "function () {}"),
  ]),
  invalidCase("function useCounter() { return { handler: enabled && (() => {}) }; }", [
    named("useCounter", "handler", "() => {}"),
  ]),
  invalidCase(
    "function useCounter() { const increment = () => {}; const handler = condition ? increment : externalHandler; return { handler }; }",
    [named("useCounter", "handler", "handler }")]
  ),
  invalidCase(
    "function useCounter() { const handler = condition ? () => {} : getHandler(); return { handler }; }",
    [named("useCounter", "handler", "handler }")]
  ),

  // 조건부 반환
  invalidCase(
    "function useCounter() { const increment = () => {}; function reset() {} return condition ? { increment } : { reset }; }",
    [named("useCounter", "increment", "increment }"), named("useCounter", "reset", "reset }")]
  ),
  invalidCase(
    `function useCounter() {
  const increment = () => {};
  if (!enabled) {
    return { increment };
  }
  return { increment, value: 1 };
}`,
    [named("useCounter", "increment", "increment }")] // 같은 변수는 한 번만
  ),

  // 같은 변수 중복 경고 없음
  invalidCase(
    "function useCounter() { const increment = () => {}; return { increment, inc: increment, list: [increment] }; }",
    [named("useCounter", "increment", "increment,")]
  ),

  // 별칭 / 재할당
  invalidCase(
    "function useCounter() { const increment = () => {}; const handler = increment; return { handler }; }",
    [named("useCounter", "handler", "handler }")]
  ),
  invalidCase(
    `function useCounter() {
  let handler = useCallback(() => {}, []);

  handler = () => {};

  return { handler };
}`,
    [named("useCounter", "handler", "handler }")]
  ),
  invalidCase(
    "function useCounter(onChange) { if (!onChange) { onChange = () => {}; } return { onChange }; }",
    [named("useCounter", "onChange", "onChange }")]
  ),

  // shadowing: 블록 안의 같은 이름 변수
  invalidCase(
    "function useCounter() { const handler = useCallback(() => {}, []); if (enabled) { const handler = () => {}; return { handler }; } return { handler }; }",
    [named("useCounter", "handler", "handler }")]
  ),
  invalidCase(
    "const handler = useCallback(() => {}, []); function useCounter() { const handler = () => {}; return { handler }; }",
    [named("useCounter", "handler", "handler }")]
  ),

  // 훅 안에서 정의한 훅 반환
  invalidCase("function useFactory() { function useInner() { return { value: 1 }; } return useInner; }", [
    named("useFactory", "useInner", "useInner; }"),
  ]),

  // 중첩된 훅은 각자 검사
  invalidCase(
    "function useOuter() { const outer = () => {}; const useInner = () => { const inner = () => {}; return { inner, outer }; }; return { useInner }; }",
    [named("useInner", "inner", "inner, outer"), named("useOuter", "useInner", "useInner }")]
  ),

  // JSX 와 함께 반환
  invalidCase(
    "function useButton() { const handleClick = () => {}; return { handleClick, element: <button onClick={() => {}} /> }; }",
    [named("useButton", "handleClick", "handleClick,")]
  ),

  // 컴포넌트를 반환하는 훅
  invalidCase("function useRenderer() { const Item = () => <li />; return { Item }; }", [
    named("useRenderer", "Item", "Item }"),
  ]),
];

// ---------------------------------------------------------------------------
// TypeScript 전용 문법
// ---------------------------------------------------------------------------

const tsValid: string[] = [
  "function useCounter(): Result { const increment = useCallback((): void => {}, []); return { increment } as const; }",
  "const useCounter = <T,>(value: T) => { const [state, setState] = useState<T>(value); return [state, setState] as const; };",
  "type increment = () => void; function useCounter() { return { value: 1 } satisfies Partial<Record<string, unknown>>; }",
];

const tsInvalid: RuleTester.InvalidTestCase[] = [
  invalidCase(
    "function useCounter(): Result { const increment = (): void => {}; return { increment } as const; }",
    [named("useCounter", "increment", "increment }")]
  ),
  invalidCase(
    "const useCounter = <T,>(value: T): Result<T> => { const reset = (next: T) => {}; return [value, reset] as const; };",
    [named("useCounter", "reset", "reset]")]
  ),
  invalidCase(
    "export function useCounter() { const handler: Handler = function () {}; return { handler } satisfies Actions; }",
    [named("useCounter", "handler", "handler }")]
  ),
  invalidCase("const useHandler = (() => () => {}) as UseHandler;", [
    inline("useHandler", "() => {})"),
  ]),
  invalidCase("function useHandler() { return (() => {}) as Handler; }", [
    inline("useHandler", "() => {}"),
  ]),
  invalidCase("function useHandler() { const handler = (() => {})!; return { handler: handler as Handler }; }", [
    named("useHandler", "handler", "handler as"),
  ]),
];

// ---------------------------------------------------------------------------
// 실행: espree(JSX) / @typescript-eslint/parser(TSX) / babel-eslint
// ---------------------------------------------------------------------------

const parserOptions: Linter.ParserOptions = { ecmaVersion: 2020, sourceType: "module", ecmaFeatures: { jsx: true } };

describe("no-unstable-hook-return", () => {
  describe("espree (JSX)", () => {
    new RuleTester({ parserOptions }).run("no-unstable-hook-return", rule, { valid, invalid });
  });

  describe("@typescript-eslint/parser (TSX)", () => {
    const tester = new RuleTester({ parser: require.resolve("@typescript-eslint/parser"), parserOptions });

    tester.run("no-unstable-hook-return", rule, { valid, invalid });
    tester.run("no-unstable-hook-return (TS syntax)", rule, { valid: tsValid, invalid: tsInvalid });
  });

  describe("babel-eslint", () => {
    new RuleTester({ parser: require.resolve("babel-eslint"), parserOptions }).run("no-unstable-hook-return", rule, {
      valid,
      invalid,
    });
  });
});
