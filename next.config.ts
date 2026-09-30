import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'use cache' + cacheTag로 데이터를 캐시하고, 발행 시 revalidateTag로 필요한 페이지만 다시 생성합니다.
  cacheComponents: true,
};

export default nextConfig;
