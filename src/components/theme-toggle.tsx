"use client";

import { useLayoutEffect } from "react";

import { DEFAULT_THEME, THEME_STORAGE_KEY, isTheme, type Theme } from "@/lib/theme";

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  // 개발 모드의 Strict Mode 재마운트가 <html>의 data-theme을 초기화하므로 다시 적용합니다. 운영 빌드에서는 변화가 없습니다.
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (stored) document.documentElement.setAttribute("data-theme", stored);
  }, []);

  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next: Theme = (isTheme(current) ? current : DEFAULT_THEME) === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 저장소를 쓸 수 없으면 이번 방문 동안만 적용합니다.
    }
  }

  // 현재 테마는 서버 렌더링 시점에 알 수 없으므로, 아이콘과 라벨을 상태 대신 data-theme 기반 CSS로 전환해 하이드레이션 불일치를 피합니다.
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex size-11 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-border-strong hover:text-fg"
    >
      <span className="sr-only light:hidden">라이트 모드로 전환</span>
      <span className="sr-only hidden light:inline">다크 모드로 전환</span>
      <svg
        aria-hidden="true"
        className="size-4 light:hidden"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        aria-hidden="true"
        className="hidden size-4 light:block"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
