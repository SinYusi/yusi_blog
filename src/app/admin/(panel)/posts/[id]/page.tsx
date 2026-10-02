import type { JSONContent } from "@tiptap/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeletePostDialog } from "@/components/admin/post-form/delete-post-dialog";
import { PostForm } from "@/components/admin/post-form/post-form";
import { PostFormSkeleton } from "@/components/admin/post-form/post-form-skeleton";
import { PostStateBadge } from "@/components/admin/post-state-badge";
import { publishModeOf, toKstDateTimeLocal } from "@/lib/admin/post-input";
import { getAdminPost, getPostFormOptions } from "@/lib/admin/posts";
import { formatDateTime } from "@/lib/format";
import { postPath } from "@/lib/site";

export const metadata: Metadata = { title: "글 수정" };

function parseId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** 에디터 원본으로 쓸 수 있는 값인지. 에디터 이전에 HTML로만 넣은 글(시드 등)은 content가 null입니다. */
function isEditorDoc(value: unknown): value is JSONContent {
  return typeof value === "object" && value !== null && (value as JSONContent).type === "doc";
}

// 세션, 경로 값, DB를 읽으므로 <Suspense> 안에서 그립니다 (Cache Components). 관리자 확인은 조회 함수 안에서 합니다.
async function EditPost({ params, searchParams }: PageProps<"/admin/posts/[id]">) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const [post, options, query] = await Promise.all([
    getAdminPost(id),
    getPostFormOptions(),
    searchParams,
  ]);
  if (!post) notFound();

  const isPublic = post.state === "published";
  const legacyBody = !isEditorDoc(post.content);
  const now = new Date();

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PostStateBadge state={post.state} />
        {post.state !== "draft" && post.publishedAt && (
          <span className="font-mono text-meta text-muted">
            {isPublic ? "발행" : "발행 예정"}{" "}
            <time dateTime={post.publishedAt.toISOString()}>
              {formatDateTime(post.publishedAt)}
            </time>
          </span>
        )}
        {isPublic && (
          <Link
            href={postPath(post.slug)}
            className="inline-flex min-h-11 items-center font-mono text-meta text-accent hover:text-accent-hover"
          >
            공개 페이지 보기 ↗
          </Link>
        )}
      </div>
      <PostForm
        postId={post.id}
        initial={{
          title: post.title,
          slug: post.slug,
          summary: post.summary,
          tags: post.tags,
          seriesId: post.seriesId,
          seriesOrder: post.seriesOrder,
          publishMode: publishModeOf(post, now),
          scheduledAt:
            post.state === "scheduled" && post.publishedAt
              ? toKstDateTimeLocal(post.publishedAt)
              : "",
          content: isEditorDoc(post.content) ? post.content : null,
        }}
        options={options}
        legacyBody={legacyBody}
        publicSlug={isPublic ? post.slug : null}
        publishedAtLabel={isPublic && post.publishedAt ? formatDateTime(post.publishedAt) : null}
        justCreated={query.created === "1"}
      />
      <DeletePostDialog postId={post.id} title={post.title} isPublic={isPublic} />
    </>
  );
}

export default function EditPostPage(props: PageProps<"/admin/posts/[id]">) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="inline-flex min-h-11 w-fit items-center font-mono text-meta text-muted hover:text-fg"
        >
          ← 글 목록
        </Link>
        <h1 className="text-h1">글 수정</h1>
      </div>
      <Suspense fallback={<PostFormSkeleton />}>
        <EditPost {...props} />
      </Suspense>
    </>
  );
}
