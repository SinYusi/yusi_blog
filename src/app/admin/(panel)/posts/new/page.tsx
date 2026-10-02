import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EditorSkeleton } from "@/components/admin/editor/editor-skeleton";
import { PostEditor } from "@/components/admin/editor/post-editor";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "새 글" };

// 세션을 읽으므로 <Suspense> 안에서 확인합니다 (Cache Components). 관리자가 아니면 에디터를 내려보내지 않습니다.
async function AdminEditor() {
  await requireAdmin();
  return <PostEditor />;
}

export default function NewPostPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="inline-flex min-h-11 w-fit items-center font-mono text-meta text-muted hover:text-fg"
        >
          ← 글 목록
        </Link>
        <h1 className="text-h1">새 글</h1>
        {/* 저장·발행은 #38에서 추가합니다. */}
        <p className="text-body text-muted">
          아직 저장되지 않습니다. 본문을 쓰고 미리보기로 공개 페이지와 같은 모양을 확인할 수
          있습니다.
        </p>
      </div>
      <Suspense fallback={<EditorSkeleton />}>
        <AdminEditor />
      </Suspense>
    </>
  );
}
