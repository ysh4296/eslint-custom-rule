# zustand-store-naming

Zustand(4.5.x)의 `create()`로 선언한 **스토어 훅의 변수명**을 정해진 패턴(기본 `useXStore`)으로 강제하는 룰입니다. 자동 수정(fix)은 지원하지 않습니다.

```tsx
import { create } from "zustand";

// ✅ 정상
const useUserStore = create(() => ({ count: 0 }));
const useProductStore = create<ProductState>()((set) => ({ products: [] }));

// ❌ 경고
const userStore = create(() => ({ count: 0 }));
const useUser = create(() => ({ count: 0 }));
```

> TypeChecker, `parserOptions.project`를 사용하지 않고 **import 선언과 스코프 분석(AST)만으로** 동작합니다.

## 설정 (`.eslintrc.json`)

```json
{
  "plugins": ["custom-rule"],
  "rules": {
    "custom-rule/zustand-store-naming": ["warn", { "pattern": "^use[A-Z][A-Za-z0-9]*Store$" }]
  }
}
```

기존 `plugins` / `rules`에 항목만 추가하면 됩니다. parser 등 다른 설정은 바꾸지 않아도 됩니다.

## 옵션

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `pattern` | `string` | `^use[A-Z][A-Za-z0-9]*Store$` | 스토어 훅 변수명에 적용할 정규식. 대소문자를 구분함 |

옵션은 `meta.schema`로 검증됩니다. 잘못된 정규식, 빈 문자열, 알 수 없는 속성이 있으면 ESLint가 설정 오류를 냅니다.

## 동작 원리

1. 파일 최상위의 `import` 선언에서 스토어를 만드는 함수를 찾습니다.

   | import | 인식 |
   | --- | --- |
   | `import { create } from "zustand"` | ✅ |
   | `import { create as createStore } from "zustand"` | ✅ alias |
   | `import create from "zustand"` | ✅ v4 에서 deprecated 된 기본 import |
   | `import * as zustand from "zustand"` → `zustand.create(...)` | ✅ |
   | `import { createWithEqualityFn } from "zustand/traditional"` | ✅ |
   | `import { create } from "./factory"`, 로컬 `function create()` | ❌ 검사 안 함 |
   | `import { createStore } from "zustand/vanilla"` | ❌ 훅이 아닌 vanilla 스토어 |

2. 그 import 바인딩의 **참조(references)** 만 스토어 생성 호출로 봅니다. 그래서 함수 매개변수 등으로 `create`라는 이름이 가려진(shadowing) 경우는 검사하지 않습니다.
3. 다음 형태의 변수 선언을 스토어 훅으로 보고 변수명을 검사합니다.
   - `const x = create(fn)`, `const x = create(devtools(persist(fn)))`
   - `const x = create<T>()(fn)`, `const x = create()(fn)` (curried)
   - `as`, `!`, `satisfies`로 감싼 경우도 포함

## 검사하지 않는 경우

- `export default create(...)`처럼 변수에 담지 않은 스토어 (이름이 없음)
- `const [a] = [create(...)]` 같은 구조 분해
- `const useX = withSelectors(create(...))`처럼 다른 함수로 감싼 경우
- `require("zustand")` (CommonJS) 로 가져온 `create`
