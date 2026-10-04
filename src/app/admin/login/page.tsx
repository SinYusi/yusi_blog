import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { signIn } from "@/auth";

export const metadata: Metadata = { title: "로그인" };

// Auth.js가 돌려주는 오류 코드 중 사용자에게 설명할 것만 문구로 바꿉니다.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "관리자로 등록된 GitHub 계정이 아닙니다.",
  Configuration: "로그인 설정에 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
};
const DEFAULT_ERROR = "로그인하지 못했습니다. 다시 시도해 주세요.";

// 로그인 뒤 돌아갈 주소는 관리자 경로로만 제한합니다 (다른 사이트로 보내는 열린 리다이렉트 방지).
function safeCallback(value: string | string[] | undefined) {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/admin") && !path.startsWith("/admin/login") ? path : "/admin";
}

async function LoginForm({ searchParams }: PageProps<"/admin/login">) {
  const { error, callbackUrl } = await searchParams;
  const redirectTo = safeCallback(callbackUrl);
  // 등록된 코드만 찾습니다. 일반 객체 조회는 프로토타입까지 보므로 ?error=__proto__ 같은 값을 막습니다.
  const message =
    typeof error === "string"
      ? Object.hasOwn(ERROR_MESSAGES, error)
        ? ERROR_MESSAGES[error]
        : DEFAULT_ERROR
      : null;

  return (
    <>
      {message && (
        <p role="alert" className="rounded-lg border border-danger px-4 py-3 text-body text-danger">
          {message}
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo });
        }}
      >
        <button
          type="submit"
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-fg px-5 text-body font-bold text-bg hover:bg-fg-secondary"
        >
          GitHub로 로그인
        </button>
      </form>
    </>
  );
}

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="flex w-full max-w-100 flex-col gap-6 rounded-2xl border border-border bg-surface p-8 md:p-10">
        <Link
          href="/"
          className="inline-flex min-h-11 w-fit items-center font-mono text-body-lg font-bold"
        >
          <span className="text-accent">~/</span>yusi_blog
          <span aria-hidden="true" className="ml-2 inline-block h-5 w-2 bg-accent" />
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-h2">관리자 로그인</h1>
          <p className="text-body text-muted">허용된 GitHub 계정만 접근할 수 있습니다.</p>
        </div>
        <Suspense>
          <LoginForm {...props} />
        </Suspense>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center font-mono text-meta text-muted hover:text-fg"
        >
          ← 블로그로 돌아가기
        </Link>
      </section>
    </main>
  );
}
