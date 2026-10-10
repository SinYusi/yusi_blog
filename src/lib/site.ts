import type { Metadata } from "next";

/*
 * 사이트 정보와 페이지 메타데이터 헬퍼. 절대 URL(canonical, Open Graph, sitemap, RSS)의 기준 주소는
 * 1) NEXT_PUBLIC_SITE_URL(커스텀 도메인을 연결하면 설정) 2) Vercel의 운영 도메인 3) 로컬 주소 순으로 정합니다.
 * 미리보기 배포도 운영 도메인을 canonical로 가리켜, 미리보기 주소가 검색 결과에 대표 주소로 잡히지 않게 합니다.
 */
export const SITE_NAME = "yusi_blog";
export const SITE_DESCRIPTION = "만들면서 부딪힌 문제를 커밋처럼 기록하는 프론트엔드 로그";
export const SITE_AUTHOR = { name: "yusi", url: "https://github.com/SinYusi" };
export const FEED_PATH = "/feed.xml";
// /sitemap.xml은 운영(Vercel)에서 저장해도 갱신되지 않아 다른 이름을 씁니다(#59). 이전 주소는 next.config.ts에서 이리로 보냅니다.
export const SITEMAP_PATH = "/sitemap-posts.xml";

function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export const SITE_URL = new URL(resolveSiteUrl());

/*
 * 검색 엔진 수집은 운영 배포(VERCEL_ENV=production)에서만 허용합니다. 환경을 알 수 없으면 막습니다.
 * Vercel 시스템 환경 변수 노출이 꺼져 있어도 미리보기가 수집되지 않게 하기 위해서입니다.
 * 로컬에서 SEO를 측정할 때는 ALLOW_INDEXING=true로 빌드합니다.
 */
export const ALLOW_INDEXING =
  process.env.VERCEL_ENV === "production" || process.env.ALLOW_INDEXING === "true";

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).href;
}

export function postPath(slug: string) {
  return `/posts/${slug}`;
}

/**
 * 동적 경로의 slug 값. 한글 slug(태그)는 페이지에는 퍼센트 인코딩된 채로, generateMetadata에는 디코딩되어 들어와
 * 양쪽을 같은 값으로 맞춥니다. slug에는 %가 들어가지 않으므로(태그 slug 규칙) 이미 디코딩된 값은 그대로입니다.
 */
export function slugParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function tagPath(slug: string) {
  return `/tags/${slug}`;
}

export function seriesPath(slug: string) {
  return `/series/${slug}`;
}

/** XML 문자열·속성 값 이스케이프 (RSS, sitemap) */
export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/*
 * 하위 페이지의 openGraph는 상위 레이아웃 값과 합쳐지지 않고 통째로 바뀌므로,
 * 페이지마다 이 헬퍼로 제목·설명·canonical·Open Graph를 함께 만듭니다.
 */
export function pageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path,
  openGraph,
}: {
  title?: string;
  description?: string;
  path: string;
  openGraph?: Metadata["openGraph"];
}): Metadata {
  return {
    ...(title && { title }),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
      title: title ?? SITE_NAME,
      description,
      url: path,
      ...openGraph,
    },
  };
}
