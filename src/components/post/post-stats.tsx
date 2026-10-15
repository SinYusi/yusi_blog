"use client";

import { useEffect, useRef, useState } from "react";

/*
 * 글 조회수·좋아요(ADR-0016). 글 HTML은 정적이므로 숫자는 브라우저에서 받아 채웁니다.
 * - 조회: 본문이 화면에 들어오면 한 번 집계합니다. 같은 브라우저·같은 글은 3시간에 한 번만 보냅니다(localStorage).
 * - 숫자: 집계 응답으로 채우고, 집계하지 않은 방문에서는 이 영역이 화면에 가까워질 때 받습니다(DB 호출을 줄임).
 * - 좋아요: 숫자를 먼저 바꾸고(낙관적 업데이트) 요청합니다. 실패하면 되돌리고 알립니다. 다시 누르면 취소됩니다.
 */
type Stats = { views: number; likes: number };

const VIEW_INTERVAL_MS = 3 * 60 * 60 * 1000;

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 저장소를 쓸 수 없으면 이번 방문 동안만 기억합니다.
  }
}

async function request(url: string, method: string): Promise<Stats> {
  // 카운터를 바꾸는 요청은 보낸 직후 페이지를 떠나도(새로고침·이동) 브라우저가 끝까지 보내게 합니다.
  // 응답 전에 문서가 닫혀 실패 처리(기록 지우기)를 못 하면, 서버는 못 받았는데 3시간 동안 다시 세지 않기 때문입니다.
  const response = await fetch(url, { method, cache: "no-store", keepalive: method !== "GET" });
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`);
  return response.json();
}

// 같은 글을 연 여러 탭이 저장된 상태를 동시에 읽고 쓰지 않도록 한 번에 하나씩 실행합니다(Web Locks).
async function withLock<T>(name: string, task: () => T | Promise<T>): Promise<T> {
  if (!("locks" in navigator)) return task();
  return navigator.locks.request(name, async (): Promise<T> => task());
}

export function PostStats({ postId }: { postId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 좋아요가 바뀔 때(이 탭의 요청 시작·끝, 다른 탭의 변경)마다 1씩 늘립니다. 그 전에 보낸 숫자 요청의 응답이 늦게 와도 덮어쓰지 않게 합니다.
  const likeVersion = useRef(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const base = `/api/posts/${postId}`;
  const viewedKey = `post-viewed:${postId}`;
  const likedKey = `post-liked:${postId}`;

  useEffect(() => {
    let cancelled = false;
    const load = (method: string, url: string, onError?: () => void) => {
      // 페이지를 떠났다 돌아오면 상태는 남은 채 다시 받으므로, 받는 동안 좋아요를 바꿨으면 응답을 버립니다.
      const version = likeVersion.current;
      return request(url, method)
        .then((next) => {
          if (cancelled || version !== likeVersion.current) return;
          // 누른 상태는 숫자와 함께 채웁니다(그 전에는 버튼이 비활성이라 서버 렌더링 결과와 어긋나지 않음).
          setLiked(readStorage(likedKey) === "1");
          setStats(next);
        })
        .catch(() => {
          // 숫자를 받지 못하면 자리표시(–)를 그대로 둡니다.
          onError?.();
        });
    };

    let visibility: IntersectionObserver | undefined;
    // 중복 요청을 막으려고 집계 전에 시각을 기록하고, 집계하지 못하면 지워 다음 방문에서 다시 보냅니다.
    const forget = (viewedAt: string) => {
      if (readStorage(viewedKey) === viewedAt) writeStorage(viewedKey, null);
    };
    const start = () => {
      withLock(`post-view:${postId}`, () => {
        if (Date.now() - Number(readStorage(viewedKey)) < VIEW_INTERVAL_MS) return null;
        const viewedAt = String(Date.now());
        writeStorage(viewedKey, viewedAt);
        return viewedAt;
      }).then((viewedAt) => {
        if (cancelled) {
          if (viewedAt) forget(viewedAt);
          return;
        }
        if (viewedAt) {
          load("POST", `${base}/view`, () => forget(viewedAt));
          return;
        }
        // 이미 센 방문이면 숫자 영역이 화면에 가까워질 때 받습니다.
        const container = containerRef.current;
        if (!container) return;
        visibility = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            visibility?.disconnect();
            load("GET", `${base}/stats`);
          },
          { rootMargin: "400px 0px" },
        );
        visibility.observe(container);
      });
    };

    // 본문을 보기 전에 떠난 방문은 집계하지 않고 DB 호출도 미룹니다.
    const body = containerRef.current?.closest("article")?.querySelector("[data-post-body]");
    let bodyVisibility: IntersectionObserver | undefined;
    if (body) {
      bodyVisibility = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        bodyVisibility?.disconnect();
        start();
      });
      bodyVisibility.observe(body);
    } else {
      start();
    }
    return () => {
      cancelled = true;
      bodyVisibility?.disconnect();
      visibility?.disconnect();
    };
  }, [base, likedKey, postId, viewedKey]);

  // 같은 글을 연 다른 탭에서 좋아요를 바꾸면 누른 상태와 숫자를 함께 맞춥니다.
  // 다른 탭은 요청 전에 바뀔 상태를, 실패하면 되돌린 상태를 쓰므로 그때마다 ±1 하면 그 탭의 숫자와 같아집니다.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== likedKey) return;
      const was = event.oldValue === "1";
      const now = event.newValue === "1";
      if (was === now) return;
      // 이 변경 전에 보낸 숫자 요청의 응답은 바뀌기 전 값일 수 있으므로 버립니다.
      likeVersion.current += 1;
      setLiked(now);
      setStats(
        (current) => current && { ...current, likes: Math.max(current.likes + (now ? 1 : -1), 0) },
      );
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [likedKey]);

  async function toggleLike() {
    if (!stats || pending) return;
    setMessage("");
    setPending(true);
    likeVersion.current += 1;
    try {
      // 저장된 상태 읽기부터 요청·저장까지 탭 사이에서 한 번에 하나씩 처리합니다.
      await withLock(`post-like:${postId}`, async () => {
        const previousStats = stats;
        // 저장된 상태를 기준으로 바꿔, 여러 탭에서 눌러도 같은 브라우저의 좋아요가 두 번 더해지거나 빠지지 않게 합니다.
        // 저장소를 쓸 수 없으면(null) 이 탭의 상태를 따릅니다.
        const stored = readStorage(likedKey);
        const next = stored === null ? !liked : stored !== "1";
        setLiked(next);
        setStats({ ...stats, likes: Math.max(stats.likes + (next ? 1 : -1), 0) });
        // 요청은 페이지를 떠나도 끝까지 가므로(keepalive) 바뀔 상태를 먼저 저장하고, 실패하면 요청 전 상태로 되돌립니다.
        // 응답 뒤에 저장하면, 그 사이 문서가 닫힐 때 서버만 바뀌고 다음 방문에서 같은 요청을 다시 보내게 됩니다.
        writeStorage(likedKey, next ? "1" : "0");
        try {
          setStats(await request(`${base}/like`, next ? "POST" : "DELETE"));
          setLiked(next);
        } catch {
          // 원래 값이 비어 있었더라도 요청 전 상태를 명시해, 기다리던 다른 탭이 오래된 화면 상태로 판단하지 않게 합니다.
          writeStorage(likedKey, next ? "0" : "1");
          // 잠금을 기다리는 동안 다른 탭에서 바뀌었을 수 있으므로, 잠금 안에서 읽은 요청 전 상태로 되돌립니다.
          setLiked(!next);
          try {
            setStats(await request(`${base}/stats`, "GET"));
          } catch {
            setStats(previousStats);
          }
          setMessage("좋아요를 반영하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
        }
      });
    } finally {
      likeVersion.current += 1;
      setPending(false);
    }
  }

  // 숫자가 오기 전에도 같은 크기로 자리를 잡아 레이아웃이 밀리지 않게 합니다(구분 기호를 포함한 다섯 자리 숫자 폭까지 미리 잡음).
  const format = (value: number | undefined) =>
    value === undefined ? "–" : value.toLocaleString("ko-KR");

  return (
    <div
      ref={containerRef}
      className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-meta text-muted"
    >
      <span>
        조회{" "}
        <span className="inline-block min-w-[6ch] text-fg tabular-nums">
          {format(stats?.views)}
        </span>
      </span>
      <button
        type="button"
        aria-pressed={liked}
        disabled={!stats || pending}
        onClick={toggleLike}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 transition-colors hover:border-border-strong hover:text-fg disabled:cursor-default aria-pressed:border-accent aria-pressed:text-accent"
      >
        <svg
          aria-hidden="true"
          className="size-4"
          viewBox="0 0 24 24"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
        </svg>
        좋아요 <span className="inline-block min-w-[6ch] tabular-nums">{format(stats?.likes)}</span>
      </button>
      <p role="status" className="basis-full empty:sr-only">
        {message}
      </p>
    </div>
  );
}
