import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import type { NextAuthRequest } from "next-auth";

import { auth, isAdminGithubId, isAuthConfigured } from "@/auth";

/*
 * 관리자 경로 앞단 확인. 세션 쿠키(JWT)의 GitHub ID만 확인하고 DB는 조회하지 않습니다(ADR-0005 "Edge에서의 DB 조회").
 * 여기서 통과해도 페이지와 서버 액션이 requireAdmin()으로 다시 확인합니다.
 * 인증 환경 변수가 없는 배포(미리보기)에서는 관리자 경로와 인증 API를 404로 둡니다.
 */
const LOGIN_PATH = "/admin/login";

// 두 번째 인자를 받아야 auth()가 미들웨어 형태(NextMiddleware)의 오버로드를 고릅니다.
const withSession = auth((request: NextAuthRequest, _event: NextFetchEvent) => {
  const isAdmin = isAdminGithubId(request.auth?.user?.githubId);
  if (isAdmin || request.nextUrl.pathname === LOGIN_PATH) return NextResponse.next();

  const login = new URL(LOGIN_PATH, request.nextUrl.origin);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!isAuthConfigured) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next();
  return withSession(request, event);
}

export const config = {
  matcher: ["/admin/:path*", "/api/auth/:path*"],
};
