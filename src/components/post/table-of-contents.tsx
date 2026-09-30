"use client";

import { useEffect, useState } from "react";

import type { TocItem } from "@/lib/content/render";

/** 데스크톱 사이드바 목차. 화면 위쪽에 들어온 소제목을 현재 위치로 표시합니다. */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    // 화면 위쪽 40% 선을 지난 마지막 소제목을 현재 위치로 봅니다. 교차 이벤트만 보면 위로 스크롤할 때
    // 이전 소제목으로 돌아가지 못하므로, 스크롤할 때마다(프레임당 한 번) 위치로 다시 계산합니다.
    // 데스크톱(lg, 64rem 이상)에서만 보이는 목차이므로, 그보다 좁으면 스크롤 계산을 등록하지 않습니다.
    const desktop = window.matchMedia("(min-width: 64rem)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > line) break;
        current = heading.id;
      }
      // 마지막 섹션이 짧으면 끝까지 내려도 마지막 소제목이 기준선에 닿지 않으므로, 페이지 끝에서는 마지막 항목을 고릅니다.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = headings[headings.length - 1].id;
      setActiveId(current);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };

    const detach = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    const sync = () => {
      detach();
      if (!desktop.matches) return;
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    };

    sync();
    desktop.addEventListener("change", sync);
    return () => {
      desktop.removeEventListener("change", sync);
      detach();
    };
  }, [items]);

  return (
    <nav aria-label="목차">
      <h2 className="mb-4 font-mono text-meta font-medium text-muted">{"// on this page"}</h2>
      <ol className="flex flex-col border-l border-border text-body">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={activeId === item.id ? "location" : undefined}
              className="-ml-px flex min-h-11 items-center border-l-2 border-transparent pl-4 text-muted hover:text-fg aria-[current=location]:border-accent aria-[current=location]:font-semibold aria-[current=location]:text-accent"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
