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

function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export const SITE_URL = new URL(resolveSiteUrl());

/** 운영 배포에서만 검색 엔진 수집을 허용합니다. Vercel 밖(로컬 빌드)에서는 제한하지 않습니다. */
export const ALLOW_INDEXING =
  process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === "production";

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).href;
}

export function postPath(slug: string) {
  return `/posts/${slug}`;
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
