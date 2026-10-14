# eslint-plugin-custom-rule

ESLint **7.29.0** 기준 커스텀 룰 플러그인. 패키지 매니저는 Yarn Classic (1.22.x).

## 구조

```
lib/
  index.js            # lib/rules/*.js 자동 등록
  rules/<rule>.js     # 룰 구현
tests/lib/rules/      # RuleTester + mocha 테스트
docs/rules/<rule>.md  # 룰 문서
playground/           # 실제 코드에 룰을 적용해보는 샌드박스
```

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
    "custom-rule/no-example-identifier": "error",
  },
};
```
