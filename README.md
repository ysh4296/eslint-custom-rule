# eslint-plugin-custom-rule

ESLint **7.29.0** 기준 커스텀 룰 플러그인. 패키지 매니저는 Yarn Classic (1.22.x).

## 구조

```
lib/
  index.js            # lib/rules/*.js 자동 등록
  rules/<rule>.js     # 룰 구현
tests/lib/rules/      # RuleTester + mocha 테스트
docs/rules/<rule>.md  # 룰 문서
playground/           # 실제 코드에 룰을 적용해보는 샌드박스 (TSX)
tests/integration.test.js  # 플러그인 이름으로 등록해 playground 를 lint 하는 통합 테스트
```

## 룰 목록

| 룰 | 설명 |
| --- | --- |
| [no-korean-literal-in-jsx](docs/rules/no-korean-literal-in-jsx.md) | JSX에서 직접 렌더링되는 한글 하드코딩 문자열 금지 |

## 개발

```bash
yarn
yarn test         # 룰 테스트
yarn test:watch   # 테스트 watch 모드
yarn lint         # 플러그인 코드 자체 lint (eslint-plugin-eslint-plugin)
yarn playground   # playground/ 에 로컬 룰 적용
```

새 룰 추가: `lib/rules/<name>.js` + `tests/lib/rules/<name>.test.js` + `docs/rules/<name>.md`.
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
  },
};
```

TS/TSX 프로젝트는 기존 `@typescript-eslint/parser` 설정을 그대로 쓰면 된다 (타입 정보 `parserOptions.project` 불필요).
JS 프로젝트는 `parserOptions.ecmaFeatures.jsx: true` 만 있으면 된다.

폐쇄망 등 GitHub 접근이 안 되는 환경에서는 `yarn pack` 으로 만든 tgz 를 옮겨 `yarn add -D file:./eslint-plugin-custom-rule-v0.1.0.tgz` 로 설치하거나,
`lib/` 폴더를 프로젝트 안(예: `eslint/`)에 복사하고 `"eslint-plugin-custom-rule": "link:./eslint"` 로 연결한다. 런타임 의존성이 없어 추가 설치가 필요 없다.
