import React from "react";

declare function t(key: string): string;

const GREETING = "안녕하세요"; // OK: JSX 바깥

type Props = { name?: string; isActive: boolean; items: string[] };

export function Sample({ name, isActive, items }: Props): JSX.Element {
  const label = "저장"; // OK: JSX 바깥

  return (
    <div>
      {/* 한글 주석은 OK */}
      안녕하세요
      <button title="저장하기" onClick={() => alert("저장됨")}>
        저장
      </button>
      <span>{"삭제"}</span>
      <input placeholder={t("name.placeholder")} />
      <p>{isActive ? "활성" : "비활성"}</p>
      <p>{name || "이름 없음"}</p>
      <p>{["사과", "바나나"].join(", ")}</p>
      <p>{`안녕하세요 ${name}님`}</p>
      <p>{t("번역 키는 OK")}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item === "완료" ? t("done") : item}</li>
        ))}
      </ul>
      <p>{label}</p>
      <p>{GREETING}</p>
    </div>
  );
}
