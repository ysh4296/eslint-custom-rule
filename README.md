# eslint-plugin-custom-rule

ESLint **7.29.0** 기준 커스텀 룰 플러그인. 패키지 매니저는 Yarn Classic (1.22.x).

## 구조

```
lib/
  index.js            # lib/rules/*.js 자동 등록
  rules/<rule>.js     # 룰 구현
  utils/              # 룰 공용 AST 유틸 (require-format 의 값 흐름 추적 / 포맷터 판별, zustand import 추적, 스코프 탐색)
tests/lib/rules/      # RuleTester + mocha 테스트 (TypeScript, ts-node 로 실행)
docs/rules/<rule>.md  # 룰 문서
playground/           # 실제 코드에 룰을 적용해보는 샌드박스 (TSX)
tests/integration.test.ts  # 플러그인 이름으로 등록해 playground 를 lint 하는 통합 테스트
tests/fixtures/       # 테스트용 파서 (Babel Optional* AST 재현)
```

## 룰 목록

| 룰 | 설명 |
| --- | --- |
| [no-korean-literal-in-jsx](docs/rules/no-korean-literal-in-jsx.md) | JSX에서 직접 렌더링되는 한글 하드코딩 문자열 금지 |
| [no-unstable-hook-return](docs/rules/no-unstable-hook-return.md) | 커스텀 훅이 렌더링마다 새로 생성되는 함수(useCallback 미사용)를 반환하는 것 금지 |
| [require-format](docs/rules/require-format.md) | 설정한 이름 패턴(`Count$`, `Date$` 등)의 값을 허용된 함수/메서드로 포맷한 뒤 JSX에 렌더링하도록 강제 |
| [zustand-store-naming](docs/rules/zustand-store-naming.md) | Zustand `create()`로 선언한 스토어 훅의 이름을 패턴(`useXStore`)으로 강제 |
| [zustand-require-shallow](docs/rules/zustand-require-shallow.md) | Zustand 스토어 훅을 selector + `zustand/shallow`의 `shallow`와 함께 호출하도록 강제 |


## 개발

```bash
yarn
yarn test         # 타입 검사(tsc) + 룰 테스트
yarn test:watch   # 테스트 watch 모드 (타입 검사 생략)
yarn typecheck    # 타입 검사만
yarn lint         # 플러그인 코드 자체 lint (eslint-plugin-eslint-plugin)
yarn playground   # playground/ 에 로컬 룰 적용
```

새 룰 추가: `lib/rules/<name>.js` + `tests/lib/rules/<name>.test.ts` + `docs/rules/<name>.md`.
`lib/index.js`가 자동으로 등록한다.

## 외부 프로젝트에 적용

```bash
yarn add -D git+https://github.com/ysh4296/eslint-custom-rule.git
```

```js
// .eslintrc.js
module.exports = {
  plugins: ["custom-rule"],
  rules: {
    "custom-rule/no-korean-literal-in-jsx": "error",
    "custom-rule/no-unstable-hook-return": "warn",
    "custom-rule/require-format": ["warn", {
      rules: [
        { pattern: "Count$", functions: ["formatCount"], methods: ["toLocaleString"] },
        { pattern: "Date$", functions: ["formatDate"] },
      ],
    }],
    "custom-rule/zustand-store-naming": ["warn", { pattern: "^use[A-Z][A-Za-z0-9]*Store$" }],
    "custom-rule/zustand-require-shallow": ["warn", {
      storePattern: "^use[A-Z][A-Za-z0-9]*Store$",
      allowNoSelector: false,
    }],
  },
};
```

TS/TSX 프로젝트는 기존 `@typescript-eslint/parser` 설정을 그대로 쓰면 된다 (타입 정보 `parserOptions.project` 불필요).
JS 프로젝트는 `parserOptions.ecmaFeatures.jsx: true` 만 있으면 된다.

폐쇄망 등 GitHub 접근이 안 되는 환경에서는 `yarn pack` 으로 만든 tgz 를 옮겨 `yarn add -D file:./eslint-plugin-custom-rule-v0.1.0.tgz` 로 설치하거나,
`lib/` 폴더를 프로젝트 안(예: `eslint/`)에 복사하고 `"eslint-plugin-custom-rule": "link:./eslint"` 로 연결한다. 런타임 의존성이 없어 추가 설치가 필요 없다.

기존 설정은 그대로 두고 `plugins` 배열에 `"custom-rule"`을, `rules`에 사용할 룰만 추가하면 된다. `extends`로 덮어쓰지 않으므로 다른 룰 결과는 바뀌지 않는다.

### 사내 npm Registry 배포

```bash
# 1. 배포 (레포 루트). package.json 의 "files": ["lib"] 에 따라 lib/ 만 포함된다
npm publish --registry https://<사내-registry>/

# 2. 설치 (사용하는 프로젝트)
yarn add -D eslint-plugin-custom-rule --registry https://<사내-registry>/
```

매번 `--registry`를 붙이지 않으려면 사용하는 프로젝트의 `.npmrc`(또는 `.yarnrc`)에 registry 를 지정한다. 스코프 패키지(`@company/eslint-plugin-custom-rule`)로 배포하면 `.eslintrc`의 플러그인 이름은 `"@company/custom-rule"`, 룰 이름은 `"@company/custom-rule/zustand-store-naming"`이 된다.
배포 전에 `version`을 올리고 `yarn test`를 통과시킨다. 런타임 의존성이 없어 ESLint 7 / Node 12 이상(Node 16 확인)에서 추가 설치 없이 동작한다.
