import type { NextConfig } from "next";

import { blobPublicHost } from "./src/lib/editor/image-policy";
import { SITEMAP_PATH } from "./src/lib/site";

const blobHost = blobPublicHost();

const nextConfig: NextConfig = {
  // 'use cache' + cacheTag로 데이터를 캐시하고, 글을 저장·삭제하면 updateTag로 공개 캐시를 무효화합니다(ADR-0013).
  cacheComponents: true,
  images: {
    // 본문 이미지는 이 배포에 연결된 Vercel Blob 공개 저장소의 posts/ 경로만 최적화합니다(ADR-0010,
    // lib/editor/image-policy.ts). 다른 Blob 저장소 주소로 이 배포의 변환량을 쓰지 못하게 호스트를 하나로 고정합니다.
    remotePatterns: blobHost
      ? [
          // search·port를 비워 두면 와일드카드가 되어 ?nonce= 같은 변형으로 변환량을 쓸 수 있으므로 비어 있는 값만 허용합니다.
          { protocol: "https", hostname: blobHost, port: "", pathname: "/posts/**", search: "" },
        ]
      : [],
    qualities: [75],
  },
  // sitemap 경로를 바꿨으므로(#59) 이전 주소로 오는 검색 엔진을 새 주소로 보냅니다.
  async redirects() {
    return [{ source: "/sitemap.xml", destination: SITEMAP_PATH, permanent: true }];
  },
};

export default nextConfig;
