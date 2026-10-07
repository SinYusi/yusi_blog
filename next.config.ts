import type { NextConfig } from "next";

import { blobPublicHost } from "./src/lib/editor/image-policy";

const blobHost = blobPublicHost();

const nextConfig: NextConfig = {
  // 'use cache' + cacheTag로 데이터를 캐시하고, 글을 저장·삭제하면 updateTag로 공개 캐시를 무효화합니다(ADR-0013).
  cacheComponents: true,
  images: {
    // 본문 이미지는 이 배포에 연결된 Vercel Blob 공개 저장소의 posts/ 경로만 최적화합니다(ADR-0010,
    // lib/editor/image-policy.ts). 다른 Blob 저장소 주소로 이 배포의 변환량을 쓰지 못하게 호스트를 하나로 고정합니다.
    remotePatterns: blobHost
      ? [{ protocol: "https", hostname: blobHost, pathname: "/posts/**" }]
      : [],
    qualities: [75],
  },
};

export default nextConfig;
