import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'use cache' + cacheTag로 데이터를 캐시하고, 글을 저장·삭제하면 updateTag로 공개 캐시를 무효화합니다(ADR-0013).
  cacheComponents: true,
  images: {
    // 본문 이미지는 Vercel Blob 공개 저장소의 posts/ 경로만 최적화합니다(ADR-0010, lib/editor/image-policy.ts).
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/posts/**" },
    ],
    qualities: [75],
  },
};

export default nextConfig;
