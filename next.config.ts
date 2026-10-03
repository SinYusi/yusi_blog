import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'use cache' + cacheTag로 데이터를 캐시하고, 글을 저장·삭제하면 updateTag로 공개 캐시를 무효화합니다(ADR-0013).
  cacheComponents: true,
};

export default nextConfig;
