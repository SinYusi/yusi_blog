import { handlers } from "@/auth";

// Auth.js 로그인·콜백·로그아웃 API. 인증 환경 변수가 없는 배포에서는 proxy가 404로 막습니다.
export const { GET, POST } = handlers;
