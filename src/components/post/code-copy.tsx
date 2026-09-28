"use client";

import { useEffect, useRef, useState } from "react";

/*
 * 본문의 코드 복사 버튼([data-copy-code])을 이벤트 위임 하나로 처리합니다.
 * 버튼 자체는 서버에서 만든 HTML에 있고, 코드 블록마다 컴포넌트를 만들지 않습니다.
 */
export function CodeCopy({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    async function onClick(event: MouseEvent) {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button[data-copy-code]",
      );
      if (!button || !root?.contains(button)) return;

      const code = button.closest("figure")?.querySelector("pre")?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "copied";
        setMessage("코드를 복사했습니다.");
      } catch {
        button.textContent = "failed";
        setMessage("코드를 복사하지 못했습니다.");
      }
      setTimeout(() => {
        button.textContent = "copy";
        setMessage("");
      }, 2000);
    }

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={ref}>
      {children}
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}
