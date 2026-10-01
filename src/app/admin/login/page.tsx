import type { Metadata } from "next";
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
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-5 font-mono text-body font-semibold text-bg hover:bg-accent-hover"
        >
          GitHub로 로그인
        </button>
      </form>
    </>
  );
}

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-meta text-muted">
          <span className="text-accent">$</span> sudo login
        </p>
        <h1 className="text-h1">관리자 로그인</h1>
        <p className="text-body text-muted">글 작성과 관리는 작성자 계정으로만 할 수 있습니다.</p>
      </div>
      <Suspense>
        <LoginForm {...props} />
      </Suspense>
    </section>
  );
}
