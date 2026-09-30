import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/*
 * 관리자 인증 (ADR-0009). 작성자 1인만 로그인할 수 있습니다.
 * - 세션은 DB 없이 암호화된 JWT 쿠키로만 둡니다. 사용자 테이블이 필요 없고, proxy에서도 DB를 조회하지 않습니다.
 * - 허용 여부는 바뀔 수 있는 사용자 이름이 아니라 GitHub 숫자 ID(ADMIN_GITHUB_ID)로 판단합니다.
 * - 인증 환경 변수는 운영과 로컬에만 있습니다. 미리보기 배포처럼 없으면 관리자 경로 전체를 404로 둡니다.
 */
export const isAuthConfigured = Boolean(
  process.env.AUTH_SECRET &&
  process.env.AUTH_GITHUB_ID &&
  process.env.AUTH_GITHUB_SECRET &&
  process.env.ADMIN_GITHUB_ID,
);

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일

export function isAdminGithubId(githubId: unknown) {
  return typeof githubId === "string" && githubId === process.env.ADMIN_GITHUB_ID;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 사용자 ID와 이름만 쓰므로 이메일 권한(user:email)은 요청하지 않습니다.
  providers: [GitHub({ authorization: { params: { scope: "read:user" } } })],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  callbacks: {
    // 허용된 계정이 아니면 로그인 자체를 거부합니다(AccessDenied). 세션 쿠키가 만들어지지 않습니다.
    signIn({ account, profile }) {
      return account?.provider === "github" && isAdminGithubId(String(profile?.id));
    },
    jwt({ token, profile }) {
      if (profile) token.githubId = String(profile.id);
      return token;
    },
    session({ session, token }) {
      session.user.githubId = typeof token.githubId === "string" ? token.githubId : undefined;
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    githubId?: string;
  }
}
