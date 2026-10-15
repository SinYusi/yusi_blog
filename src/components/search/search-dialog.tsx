"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatDate } from "@/lib/format";
import {
  SEARCH_INDEX_PATH,
  highlightParts,
  search,
  searchTerms,
  type SearchDoc,
} from "@/lib/search";
import { postPath } from "@/lib/site";

/*
 * 글 검색 창(ADR-0015). 머리글의 검색 버튼이나 ⌘K(Ctrl+K)로 엽니다.
 * - 색인(/search-index.json)은 창을 처음 열 때 받습니다. 글 페이지의 첫 화면 JS·데이터에는 들어가지 않습니다.
 * - 네이티브 <dialog>의 showModal()로 포커스 가두기·Esc 닫기·배경 비활성화를 브라우저에 맡깁니다.
 * - 입력칸은 combobox, 결과는 listbox(aria-activedescendant)라 화살표로 고르는 항목을 화면 낭독기가 읽습니다.
 * - 모바일은 전체 화면(시안 SearchMobile), 태블릿 이상은 위쪽 가운데 창(시안 Search)입니다.
 */
const LISTBOX_ID = "search-results";
const optionId = (index: number) => `search-result-${index}`;

export function SearchDialog() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const terms = useMemo(() => searchTerms(query), [query]);
  const results = useMemo(() => (docs ? search(docs, query) : []), [docs, query]);

  const loadingRef = useRef(false);
  function open() {
    dialogRef.current?.showModal();
    if (docs || loadingRef.current) return;
    loadingRef.current = true;
    setFailed(false);
    fetch(SEARCH_INDEX_PATH)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: SearchDoc[]) => setDocs(data))
      .catch(() => setFailed(true))
      .finally(() => {
        loadingRef.current = false;
      });
  }
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  // ⌘K(macOS)·Ctrl+K로 어느 공개 페이지에서든 엽니다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 화살표로 고른 항목이 목록 밖에 있으면 보이도록 목록을 스크롤합니다.
  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(doc: SearchDoc) {
    dialogRef.current?.close();
    router.push(postPath(doc.slug));
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // 한글 등 IME 조합 중의 Enter·방향키는 글자 확정·후보 선택이므로 건너뜁니다.
    // Safari는 조합을 확정하는 Enter에서 isComposing이 false일 수 있어 keyCode 229(조합 중 입력)도 봅니다.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[Math.min(active, results.length - 1)].doc);
    }
  }

  const status = failed
    ? "검색 색인을 불러오지 못했습니다. 창을 닫았다가 다시 열어 보세요."
    : !docs
      ? "검색 색인을 불러오는 중입니다."
      : terms.length === 0
        ? "제목, 태그, 본문으로 글을 찾습니다."
        : results.length === 0
          ? "일치하는 글이 없습니다."
          : `글 ${results.length}개`;

  return (
    <>
      <button
        type="button"
        aria-label="검색"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={open}
        className="flex size-11 items-center justify-center gap-2 text-fg md:rounded-lg md:border md:border-border md:text-muted md:hover:border-border-strong md:hover:text-fg lg:w-auto lg:bg-surface lg:px-3.5 lg:font-mono lg:text-meta"
      >
        <SearchIcon className="size-5 md:size-4" />
        <span aria-hidden="true" className="hidden lg:inline">
          검색
        </span>
        <kbd
          aria-hidden="true"
          className="hidden rounded-sm border border-border-strong px-1.5 font-mono text-caption lg:inline"
        >
          ⌘K
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="글 검색"
        onClose={() => setFailed(false)}
        // 창 바깥(배경)을 누르면 닫습니다. 배경을 누르면 이벤트 대상이 <dialog> 자신입니다.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-fg backdrop:bg-bg/80 md:bottom-auto md:mx-auto md:mt-24 md:h-auto md:max-h-[calc(100dvh-var(--spacing)*48)] md:max-w-article md:rounded-2xl md:border md:border-border-strong"
      >
        <div className="flex h-full flex-col md:h-auto md:max-h-[inherit]">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3 md:py-0">
            <SearchIcon className="size-5 shrink-0 text-muted" />
            <input
              autoFocus
              type="search"
              role="combobox"
              aria-label="검색어"
              aria-expanded={results.length > 0}
              aria-controls={LISTBOX_ID}
              aria-autocomplete="list"
              aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="글 검색"
              className="h-12 min-w-0 flex-1 bg-transparent text-body-lg outline-none placeholder:text-muted md:h-16"
            />
            {/* 닫기 버튼. 모바일은 "취소", 태블릿 이상은 Esc 키 모양으로 보이지만 누를 수 있습니다(물리 키보드가 없을 때). */}
            <button
              type="button"
              aria-label="검색 닫기"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-body md:text-muted md:hover:text-fg"
            >
              <span aria-hidden="true" className="md:hidden">
                취소
              </span>
              <kbd
                aria-hidden="true"
                className="hidden rounded-sm border border-border-strong px-2 font-mono text-caption md:inline"
              >
                Esc
              </kbd>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 md:flex-auto md:px-3">
            <p role="status" className="px-0 py-2 font-mono text-caption text-muted md:px-4">
              {status}
            </p>
            <ul
              id={LISTBOX_ID}
              role="listbox"
              aria-label="검색 결과"
              className="flex flex-col gap-1"
            >
              {results.map(({ doc, snippet }, index) => (
                <li
                  key={doc.slug}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  onClick={() => go(doc)}
                  onMouseMove={() => setActive(index)}
                  className="cursor-pointer border-b border-border py-4 aria-selected:bg-surface md:rounded-lg md:border-0 md:px-4 md:py-3.5 md:aria-selected:outline-2 md:aria-selected:-outline-offset-2 md:aria-selected:outline-accent"
                >
                  <p className="text-body font-semibold">
                    <Highlight value={doc.title} terms={terms} />
                  </p>
                  {snippet && (
                    <p className="mt-1 text-body text-muted">
                      <Highlight value={snippet} terms={terms} />
                    </p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-caption">
                    <span className="text-date">{formatDate(new Date(doc.publishedAt))}</span>
                    {doc.tags.map((tag) => (
                      <span key={tag} className="text-accent">
                        #<Highlight value={tag} terms={terms} />
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="hidden gap-5 border-t border-border px-5 py-3 font-mono text-caption text-muted md:flex">
            <span>↑↓ 이동</span>
            <span>Enter 열기</span>
            <span>Esc 닫기</span>
          </p>
        </div>
      </dialog>
    </>
  );
}

function Highlight({ value, terms }: { value: string; terms: string[] }) {
  return highlightParts(value, terms).map((part, i) =>
    part.match ? (
      <mark key={i} className="rounded-sm bg-accent/20 text-fg">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

function SearchIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
