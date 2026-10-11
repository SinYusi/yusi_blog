import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_OG_IMAGE } from "./site";

/*
 * Open Graph 이미지(1200×630) 공통 틀. 글마다 이미지와 사이트 공용 이미지가 함께 씁니다.
 * ImageResponse는 CSS 변수와 woff2 웹 폰트를 쓰지 못해, 다크 테마 토큰 값(src/app/globals.css)을 그대로 적고
 * 한글 TTF(assets/fonts, OFL)를 읽습니다. 저장소의 파일을 읽으므로 빌드·재생성이 외부 네트워크에 의존하지 않습니다.
 */
export const OG_SIZE = { width: SITE_OG_IMAGE.width, height: SITE_OG_IMAGE.height };
export const OG_CONTENT_TYPE = "image/png";

// globals.css의 다크 테마(기본) 토큰 값. 토큰을 바꾸면 여기도 맞춥니다.
const COLOR = {
  bg: "#0e1320",
  border: "#263049",
  fg: "#e3e8f2",
  muted: "#8f9bb5",
  accent: "#6cb6ff",
  date: "#f2b134",
};

// Cache Components에서 캐시하지 않은 파일 읽기는 요청 시점 작업으로 보아 이미지가 동적이 되므로 캐시합니다(폰트는 배포마다 고정).
async function loadFont() {
  "use cache";
  cacheLife("max");
  return readFile(join(process.cwd(), "assets/fonts/IBMPlexSansKR-Bold.ttf"));
}

export async function renderOgImage({
  eyebrow,
  title,
  footer,
}: {
  /** 제목 위 한 줄 (터미널 명령 형식) */
  eyebrow: string;
  title: string;
  /** 바닥 줄: 날짜(date 색)와 태그(accent 색) */
  footer?: { date?: string; tags?: string[] };
}) {
  // 긴 제목은 글자를 줄여 세 줄 안에 들어가게 하고, 그래도 넘치면 말줄임합니다.
  const titleSize = title.length > 48 ? 52 : title.length > 28 ? 60 : 68;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        background: COLOR.bg,
        color: COLOR.fg,
        fontFamily: "IBM Plex Sans KR",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, fontSize: 30 }}>
        <span style={{ color: COLOR.accent }}>~/</span>
        {SITE_NAME}
        <span style={{ width: 14, height: 30, marginLeft: 10, background: COLOR.accent }} />
      </div>

      {/* 긴 글자는 줄 수를 제한하고 말줄임합니다(lineClamp는 display: block에서만 적용). 남는 높이는 가운데 정렬합니다. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flexGrow: 1,
          gap: 24,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: 14, fontSize: 26, color: COLOR.muted }}>
          <span style={{ flexShrink: 0, color: COLOR.accent }}>$</span>
          <div style={{ display: "block", lineClamp: 1 }}>{eyebrow}</div>
        </div>
        <div
          style={{
            display: "block",
            fontSize: titleSize,
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
            // 한글을 글자 단위가 아니라 단어(띄어쓰기) 단위로 줄바꿈합니다.
            wordBreak: "keep-all",
            lineClamp: 3,
          }}
        >
          {title}
        </div>
      </div>

      {footer && (
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            gap: 24,
            paddingTop: 28,
            borderTop: `2px solid ${COLOR.border}`,
            fontSize: 26,
          }}
        >
          {footer.date && <span style={{ flexShrink: 0, color: COLOR.date }}>{footer.date}</span>}
          {footer.tags && footer.tags.length > 0 && (
            <div style={{ display: "block", color: COLOR.accent, lineClamp: 1 }}>
              {footer.tags.map((tag) => `#${tag}`).join(" ")}
            </div>
          )}
        </div>
      )}
    </div>,
    {
      ...OG_SIZE,
      fonts: [{ name: "IBM Plex Sans KR", data: await loadFont(), weight: 700, style: "normal" }],
    },
  );
}
