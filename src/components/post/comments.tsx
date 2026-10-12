"use client";

import Giscus from "@giscus/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/theme";

/*
 * 글 댓글 (Giscus, GitHub Discussions). 댓글은 저장소의 Comments 카테고리 토론에 저장됩니다.
 * 공식 컴포넌트(@giscus/react)는 컴포넌트마다 iframe을 직접 만들어, 글을 옮겨 다녀도 이전 글의 로드가 새 글을 덮지 않고
 * 로그인 복귀(?giscus 세션 저장, id로 돌아오기)와 iframe 준비 뒤 설정(테마) 재전송을 처리합니다.
 * - 연결: slug는 바뀔 수 있어(ADR-0012) 글 id로 만든 이름(posts/<id>)으로 토론을 찾고, strict로 비슷한 이름에 붙지 않게 합니다.
 * - 지연 로드: 정적 생성 결과에는 빈 영역만 두고, 댓글 영역이 화면에 가까워질 때(또는 로그인에서 돌아왔을 때) 그립니다.
 * - 테마: 사이트 테마(<html data-theme>)를 따라갑니다.
 */
const GISCUS_THEME: Record<Theme, string> = { dark: "transparent_dark", light: "light" };

function currentTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return isTheme(value) ? value : DEFAULT_THEME;
}

// 테마 토글이 <html data-theme>을 바꾸면 다시 읽습니다.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function Comments({ postId }: { postId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => DEFAULT_THEME);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 댓글 영역이 화면에 가까워지면 그립니다. GitHub 로그인(OAuth)에서 돌아와 주소에 ?giscus=<세션>이 붙어 있으면
    // 감지 범위를 문서 전체로 넓혀 바로 그리고, 세션을 저장하게 합니다.
    const returningFromLogin = new URLSearchParams(window.location.search).has("giscus");
    const visibility = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        visibility.disconnect();
        setVisible(true);
      },
      { rootMargin: returningFromLogin ? "100000px 0px" : "400px 0px" },
    );
    visibility.observe(container);
    return () => visibility.disconnect();
  }, []);

  return (
    <section aria-labelledby="comments-heading" className="mt-14 border-t border-border pt-7">
      <h2 id="comments-heading" className="mb-6 font-mono text-meta font-medium text-muted">
        {"// comments"}
      </h2>
      <div ref={containerRef}>
        {visible && (
          // id: 로그인 뒤 이 위치로 돌아옵니다(본문 소제목 id와 겹치지 않는 이름).
          // key: 다른 글로 옮기면 새 iframe을 만들어 이전 글의 토론이 남지 않게 합니다.
          <Giscus
            key={postId}
            id="giscus-comments"
            repo="SinYusi/yusi_blog"
            repoId="R_kgDOUs-TxQ"
            category="Comments"
            categoryId="DIC_kwDOUs-Txc4DH_Xy"
            mapping="specific"
            term={`posts/${postId}`}
            strict="1"
            reactionsEnabled="1"
            emitMetadata="0"
            inputPosition="top"
            theme={GISCUS_THEME[theme]}
            lang="ko"
          />
        )}
      </div>
    </section>
  );
}
