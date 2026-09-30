import { Suspense } from "react";

import { signOut } from "@/auth";
import { requireAdmin } from "@/lib/auth/admin";

// 관리자 첫 화면. 글 목록과 편집 화면은 #36부터 이어서 만듭니다.
async function AdminHome() {
  const admin = await requireAdmin();

  return (
    <>
      <p className="text-body text-muted">
        <span className="font-semibold text-fg">{admin.name}</span> 계정으로 로그인했습니다.
      </p>
      <form
        action={async () => {
          "use server";
          await requireAdmin();
          await signOut({ redirectTo: "/admin/login" });
        }}
      >
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg border border-border-strong px-4 font-mono text-meta text-muted hover:text-fg"
        >
          로그아웃
        </button>
      </form>
    </>
  );
}

export default function AdminPage() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-meta text-muted">
          <span className="text-accent">$</span> cd admin/
        </p>
        <h1 className="text-h1">관리자</h1>
      </div>
      <Suspense fallback={<p className="text-body text-muted">계정을 확인하는 중입니다.</p>}>
        <AdminHome />
      </Suspense>
    </section>
  );
}
