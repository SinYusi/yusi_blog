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

    // 화면 위쪽 40% 영역을 지나는 소제목을 현재 위치로 봅니다.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
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
