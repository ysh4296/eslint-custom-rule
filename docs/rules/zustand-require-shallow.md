# zustand-require-shallow

Zustand(4.5.x) 스토어 훅을 사용할 때 **selector를 `useShallow`로 감싸거나, selector와 함께 `zustand/shallow`의 `shallow`를 전달하도록** 강제하는 룰입니다. 자동 수정(fix)은 지원하지 않습니다.

```tsx
import { shallow } from "zustand/shallow";
import { useShallow } from "zustand/react/shallow";

// ✅ 정상
const count = useUserStore((state) => state.count, shallow);
const user = useUserStore((state) => ({ name: state.name, age: state.age }), shallow);
const user2 = useUserStore(useShallow((state) => ({ name: state.name, age: state.age })));

// ❌ 경고
const count = useUserStore((state) => state.count);              // shallow 누락
const user = useUserStore((state) => ({ name: state.name }));     // shallow 누락
const same = useUserStore((state) => state.count, Object.is);    // shallow 가 아닌 비교 함수
const state = useUserStore();                                     // selector 없이 전체 구독
```

> 이 룰의 목적은 성능 최적화가 아니라 **팀의 Zustand 사용 컨벤션을 일관되게 강제하는 것**입니다. 아래 [shallow 의 성능 특성](#shallow-의-성능-특성)을 함께 확인하세요.

## 설정 (`.eslintrc.json`)

```json
{
  "plugins": ["custom-rule"],
  "rules": {
    "custom-rule/zustand-require-shallow": [
      "warn",
      { "storePattern": "^use[A-Z][A-Za-z0-9]*Store$", "allowNoSelector": false }
    ]
  }
}
```

## 옵션

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `storePattern` | `string` | `^use[A-Z][A-Za-z0-9]*Store$` | **다른 파일에서 import 한** 스토어 훅을 판별할 정규식. `zustand-store-naming`의 `pattern`과 같은 값을 쓰는 것을 권장 |
| `allowNoSelector` | `boolean` | `false` | `true`이면 selector 없는 호출(`useUserStore()`)을 허용 |

옵션은 `meta.schema`로 검증됩니다.

## 동작 원리

### 1. 어떤 호출을 스토어 훅으로 보는가

| 대상 | 판단 기준 |
| --- | --- |
| 같은 파일에서 `create()`로 선언한 변수 | **실제 선언을 확인**합니다. 이름이 `storePattern`과 달라도 검사합니다 (`zustand-store-naming`과 같은 인식 규칙) |
| 다른 파일에서 import 한 값 | 선언을 볼 수 없으므로 **이름**으로 판단합니다. 원래 export 이름 또는 로컬 alias 중 하나가 `storePattern`과 일치하면 검사합니다 (`import { useUserStore as useUsers }`도 검사) |
| 같은 파일의 일반 함수/변수 (`function useCustomStore() {}`) | 검사하지 않음. Zustand 스토어로 확정할 수 없기 때문 |
| 선언도 import 도 없는 전역 이름 | 검사하지 않음 |
| `zustand` 패키지 자체에서 import 한 값 (`useStore` 등) | 검사하지 않음 |
| `import type { ... }` | 검사하지 않음 |

이렇게 판단을 확정할 수 없는 경우는 **검사하지 않는 쪽(오탐 최소화)** 을 택했습니다.

### 2. 어떤 사용을 검사하는가

스토어 변수의 참조 중 **직접 호출(`useUserStore(...)`)만** 검사합니다.
`useUserStore.getState()`, `.setState()`, `.subscribe()`, `.destroy()` 같은 정적 API나, `useStore(useUserStore, ...)`처럼 값으로 넘기는 경우는 검사하지 않습니다.

### 3. 호출 검사

| 호출 | 결과 |
| --- | --- |
| `useX()` | `missingSelector` (`allowNoSelector: true`이면 허용) |
| `useX(selector)` | `missingShallow` |
| `useX(useShallow(selector))` | ✅ 단, `useShallow`가 **`zustand/react/shallow` 또는 `zustand/shallow`의 import를 실제로 참조**할 때만 (alias, namespace import 포함) |
| `useX(selector, 다른 함수)` | `invalidEqualityFn` |
| `useX(selector, shallow)` | ✅ 단, `shallow`가 **`zustand/shallow`의 named import를 실제로 참조**할 때만 |
| `useX(...args)` | 검사하지 않음 (인자를 정적으로 알 수 없음) |

두 번째 인자는 **이름이 아니라 import 바인딩의 참조인지**로 판단합니다.

```tsx
import { shallow as compare } from "zustand/shallow";
useUserStore((s) => s.count, compare);         // ✅ alias

import * as zs from "zustand/shallow";
useUserStore((s) => s.count, zs.shallow);      // ✅ namespace import

function shallow(a, b) { return a === b; }
useUserStore((s) => s.count, shallow);         // ❌ 같은 이름의 로컬 함수

import { shallow } from "./utils/shallow";
useUserStore((s) => s.count, shallow);         // ❌ 다른 모듈의 shallow

import shallow from "zustand/shallow";
useUserStore((s) => s.count, shallow);         // ❌ v4 에서 deprecated 된 기본 import
```

## 타입 분석 없이 생기는 한계

### 오탐 (경고가 나지만 실제로는 Zustand 스토어가 아님)

- 다른 파일에서 import 한 일반 훅의 이름이 `storePattern`과 일치하는 경우
  (예: `import { useCustomStore } from "./custom"`가 Zustand와 무관한 훅)
  → `storePattern`을 팀 컨벤션에 맞게 좁히거나, 해당 줄에 `eslint-disable-next-line`을 쓰세요.

### 미탐 (Zustand 스토어인데 검사하지 않음)

- 다른 파일에서 import 했지만 이름이 `storePattern`과 다른 스토어
- `import * as stores from "./stores"` → `stores.useUserStore(...)` 형태의 호출
- `const useX = withSelectors(create(...))`처럼 감싼 뒤 같은 파일에서 사용하는 스토어
- `const useAlias = useUserStore`처럼 다른 변수에 다시 담은 뒤 호출
- `require()` (CommonJS) 로 가져온 스토어나 `shallow`
- 선언이 없는 전역 이름

## shallow 의 성능 특성

- `shallow`는 selector 결과를 **한 단계 깊이까지만** 비교합니다. 매 렌더마다 새로 만들어지는 **객체/배열 selector**(`(s) => ({ a: s.a, b: s.b })`)에서는 불필요한 리렌더를 막아줍니다.
- **단일 primitive selector(`(s) => s.count`)에 `shallow`를 적용해도 성능 향상은 보장되지 않습니다.** primitive 값은 기본 비교(`Object.is`)와 결과가 같고, 비교 함수 호출 비용만 늘어납니다. 이 룰은 그런 경우에도 일관성을 위해 `shallow`를 요구합니다.
- 중첩 객체의 내부 변경은 감지하지 못합니다. selector는 필요한 값만 평평하게 골라 반환하는 것이 좋습니다.

## Zustand 4.5.x 사용 시 주의: `create` + equality 함수 deprecation

Zustand **v4.4부터** `zustand`의 `create`로 만든 훅에 두 번째 인자(equality 함수)를 넘기면, 개발 모드에서 다음 경고를 **한 번** 출력합니다.

```
[DEPRECATED] Use `createWithEqualityFn` instead of `create` or use `useStoreWithEqualityFn` instead of `useStore`.
They can be imported from 'zustand/traditional'.
```

동작은 그대로 하지만 이 컨벤션을 따르면 콘솔 경고가 나옵니다. 경고 없이 쓰려면 `useX(useShallow(selector))` 형태를 쓰거나(이 룰이 허용), 스토어를 `zustand/traditional`의 `createWithEqualityFn`으로 만드세요. 이 룰과 `zustand-store-naming` 모두 `createWithEqualityFn`을 스토어 생성 함수로 인식합니다.

```tsx
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";

export const useUserStore = createWithEqualityFn<UserState>()((set) => ({ count: 0 }), shallow);
```

Zustand v5에서는 `create`의 equality 함수 인자가 제거되었으므로, v5로 올릴 때는 `useX(selector, shallow)` 허용을 빼고 `useShallow` 형태만 허용하도록 룰을 바꿔야 합니다.
