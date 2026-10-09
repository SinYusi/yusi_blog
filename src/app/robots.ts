import type { MetadataRoute } from "next";

import { ALLOW_INDEXING, SITEMAP_PATH, absoluteUrl } from "@/lib/site";

// 미리보기 배포는 수집을 막습니다. 디자인 토큰 페이지는 페이지 메타데이터(noindex)로 제외합니다.
export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl(SITEMAP_PATH),
  };
}
