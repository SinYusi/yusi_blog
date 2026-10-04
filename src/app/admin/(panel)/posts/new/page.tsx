import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PostForm } from "@/components/admin/post-form/post-form";
import { PostFormSkeleton } from "@/components/admin/post-form/post-form-skeleton";
import { getPostFormOptions } from "@/lib/admin/posts";

export const metadata: Metadata = { title: "새 글" };

// 세션과 DB를 읽으므로 <Suspense> 안에서 그립니다 (Cache Components). 관리자 확인은 getPostFormOptions 안에서 합니다.
async function NewPostForm() {
  const options = await getPostFormOptions();
  return (
    <PostForm
      postId={null}
      initial={{
        title: "",
        slug: "",
        summary: "",
        tags: [],
        seriesId: null,
        seriesOrder: null,
        publishMode: "draft",
        scheduledAt: "",
        content: null,
      }}
      options={options}
      legacyBody={false}
      publicSlug={null}
      publishedAtLabel={null}
      justCreated={false}
    />
  );
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
      </div>
      <Suspense fallback={<PostFormSkeleton />}>
        <NewPostForm />
      </Suspense>
    </>
  );
}
