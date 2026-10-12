"use client";

import { useEffect, useRef } from "react";

import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/theme";

/*
 * 글 댓글 (Giscus, GitHub Discussions). 스크립트가 iframe을 만들고, 댓글은 저장소의 Comments 카테고리 토론에 저장됩니다.
 * - 연결: slug는 바뀔 수 있어(ADR-0012) 글 id로 만든 이름(posts/<id>)으로 토론을 찾고, strict로 비슷한 이름에 붙지 않게 합니다.
 * - 지연 로드: 서버 렌더링 결과(정적 생성)에는 빈 영역만 두고, 브라우저에서 화면에 가까워질 때 iframe을 불러옵니다.
 * - 테마: 사이트 테마(<html data-theme>)가 바뀌면 iframe에 알려 같은 테마로 바꿉니다.
 */
const GISCUS_ORIGIN = "https://giscus.app";
const REPO = "SinYusi/yusi_blog";
const REPO_ID = "R_kgDOUs-TxQ";
const CATEGORY = "Comments";
const CATEGORY_ID = "DIC_kwDOUs-Txc4DH_Xy";

const GISCUS_THEME: Record<Theme, string> = { dark: "transparent_dark", light: "light" };

function currentTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function Comments({ postId }: { postId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = `${GISCUS_ORIGIN}/client.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    for (const [key, value] of Object.entries({
      repo: REPO,
      "repo-id": REPO_ID,
      category: CATEGORY,
      "category-id": CATEGORY_ID,
      mapping: "specific",
      term: `posts/${postId}`,
      strict: "1",
      "reactions-enabled": "1",
      "emit-metadata": "0",
      "input-position": "top",
      theme: GISCUS_THEME[currentTheme()],
      lang: "ko",
      loading: "lazy",
    })) {
      script.setAttribute(`data-${key}`, value);
    }
    container.append(script);

    // 테마 토글이 <html data-theme>을 바꾸면 iframe에 새 테마를 보냅니다.
    // ponytail: iframe이 아직 불러와지는 중에 바꾼 테마는 전달되지 않음, 문제가 되면 giscus의 준비 메시지를 받은 뒤 다시 보냄
    const observer = new MutationObserver(() => {
      const frame = container.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
      frame?.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: GISCUS_THEME[currentTheme()] } } },
        GISCUS_ORIGIN,
      );
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      container.replaceChildren();
    };
  }, [postId]);

  return (
    <section aria-labelledby="comments-heading" className="mt-14 border-t border-border pt-7">
      <h2 id="comments-heading" className="mb-6 font-mono text-meta font-medium text-muted">
        {"// comments"}
      </h2>
      <div ref={containerRef} />
    </section>
  );
}
