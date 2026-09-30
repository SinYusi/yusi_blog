"use client";

import { useRef } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

import { GITHUB_URL, NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";

/*
 * 네이티브 <dialog>의 showModal()을 씁니다. 포커스 가두기, Esc로 닫기, 배경 비활성화(inert)를 브라우저가 처리하고,
 * 닫히면 여는 버튼으로 포커스가 돌아갑니다.
 */
export function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="flex size-11 items-center justify-center text-fg md:hidden"
      >
        <svg
          aria-hidden="true"
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="주요 메뉴"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-fg backdrop:bg-bg"
      >
        <div className="flex h-full flex-col px-5">
          <div className="flex items-center justify-between border-b border-border py-3">
            <span className="font-mono text-body font-bold">
              <span className="text-accent">~/</span>yusi_blog
            </span>
            <button
              type="button"
              aria-label="메뉴 닫기"
              onClick={close}
              className="flex size-11 items-center justify-center"
            >
              <svg
                aria-hidden="true"
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav aria-label="주요 메뉴" className="flex flex-col pt-6">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                onNavigate={close}
                className="flex min-h-16 items-center border-b border-border text-h2 aria-[current=page]:text-accent"
              >
                <span className="font-mono text-body-lg text-accent">./</span>
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex items-center justify-between py-8">
            <a
              href={GITHUB_URL}
              className="inline-flex min-h-11 items-center px-2 font-mono text-meta text-muted hover:text-fg"
            >
              github
            </a>
            <ThemeToggle />
          </div>
        </div>
      </dialog>
    </>
  );
}
