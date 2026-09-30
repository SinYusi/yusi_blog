import "server-only";

import { notFound, redirect } from "next/navigation";

import { auth, isAdminGithubId, isAuthConfigured } from "@/auth";

export type AdminUser = { name: string; image: string | null };

/*
 * 관리자 확인(Data Access Layer). proxy는 세션 쿠키가 있는지만 보므로, 관리자 데이터를 읽거나 쓰는
 * 페이지와 서버 액션은 모두 여기서 세션과 허용 계정을 다시 확인합니다.
 * 세션을 읽는 호출이므로 페이지에서는 <Suspense> 안에서 부릅니다(Cache Components).
 */
export async function requireAdmin(): Promise<AdminUser> {
  if (!isAuthConfigured) notFound();

  const session = await auth();
  if (!session?.user || !isAdminGithubId(session.user.githubId)) {
    redirect("/admin/login");
  }
  return { name: session.user.name ?? "admin", image: session.user.image ?? null };
}
