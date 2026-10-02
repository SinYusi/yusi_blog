import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  ADMIN_POST_STATES,
  getAdminPosts,
  type AdminPostRow,
  type AdminPostState,
} from "@/lib/admin/posts";
import { formatDate, formatDateTime } from "@/lib/format";
import { postPath } from "@/lib/site";

export const metadata: Metadata = { title: "글" };

const FILTERS = [
  { state: null, label: "전체" },
  { state: "published", label: "발행" },
  { state: "draft", label: "초안" },
  { state: "scheduled", label: "예약" },
] as const satisfies { state: AdminPostState | null; label: string }[];

const STATE_BADGE: Record<AdminPostState, { label: string; dot: string; text: string }> = {
  published: { label: "발행", dot: "bg-success", text: "text-success" },
  scheduled: { label: "예약", dot: "bg-date", text: "text-date" },
  draft: { label: "초안", dot: "bg-muted", text: "text-muted" },
};

function parseState(value: string | string[] | undefined): AdminPostState | null {
  return typeof value === "string" && (ADMIN_POST_STATES as readonly string[]).includes(value)
    ? (value as AdminPostState)
    : null;
}

function filterHref(state: AdminPostState | null, query: string) {
  const params = new URLSearchParams();
  if (state) params.set("status", state);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/admin?${search}` : "/admin";
}

function StateBadge({ state }: { state: AdminPostState }) {
  const badge = STATE_BADGE[state];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-border-strong px-3 py-1 font-mono text-caption ${badge.text}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${badge.dot}`} />
      {badge.label}
    </span>
  );
}

function PublishedCell({ post }: { post: AdminPostRow }) {
  if (!post.publishedAt) return <span className="text-muted">—</span>;
  return post.state === "scheduled" ? (
    <time dateTime={post.publishedAt.toISOString()}>{formatDateTime(post.publishedAt)}</time>
  ) : (
    <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
  );
}

async function PostTable({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams;
  const state = parseState(params.status);
  const query = typeof params.q === "string" ? params.q : "";
  const { items, counts } = await getAdminPosts({ state, query });

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border md:flex-row md:items-end md:justify-between">
        <nav aria-label="상태 필터" className="flex gap-6 overflow-x-auto">
          {FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={filterHref(filter.state, query)}
              aria-current={filter.state === state ? "page" : undefined}
              className="-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-1 text-body text-muted hover:text-fg aria-[current=page]:border-accent aria-[current=page]:font-semibold aria-[current=page]:text-fg"
            >
              {filter.label}
              <span className="font-mono text-caption text-muted">
                {counts[filter.state ?? "all"]}
              </span>
            </Link>
          ))}
        </nav>

        <form action="/admin" role="search" className="mb-3 flex items-center gap-2">
          {state && <input type="hidden" name="status" value={state} />}
          <label htmlFor="admin-post-search" className="sr-only">
            글 제목 검색
          </label>
          <input
            id="admin-post-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="제목 검색"
            className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-body text-fg placeholder:text-muted md:w-60"
          />
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center rounded-lg border border-border-strong px-4 font-mono text-meta text-muted hover:text-fg"
          >
            검색
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-body text-muted">
          {counts.all === 0 ? "아직 글이 없습니다." : "조건에 맞는 글이 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="글 목록">
          <table className="w-full min-w-160 border-collapse text-left">
            <caption className="sr-only">
              글 목록: 제목, 상태, 발행(예정) 시각, 수정일, 조회수
            </caption>
            <thead>
              <tr className="border-b border-border font-mono text-caption text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  제목
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  상태
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  발행(예정)
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  수정일
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  조회수
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id} className="border-b border-border">
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-body font-semibold">{post.title}</span>
                      {post.state === "published" && (
                        <Link
                          href={postPath(post.slug)}
                          aria-label={`${post.title} 공개 페이지 보기`}
                          className="inline-flex min-h-11 items-center font-mono text-caption text-accent hover:text-accent-hover"
                        >
                          보기 ↗
                        </Link>
                      )}
                    </div>
                    {post.tags.length > 0 && (
                      <p className="mt-1 font-mono text-caption text-muted">
                        {post.tags.map((tag) => `#${tag}`).join(" ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <StateBadge state={post.state} />
                  </td>
                  <td className="px-4 py-4 font-mono text-meta whitespace-nowrap text-muted">
                    <PublishedCell post={post} />
                  </td>
                  <td className="px-4 py-4 font-mono text-meta whitespace-nowrap text-muted">
                    <time dateTime={post.updatedAt.toISOString()}>
                      {formatDate(post.updatedAt)}
                    </time>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-meta text-muted">
                    {post.viewCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AdminPostsPage(props: PageProps<"/admin">) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-h1">글</h1>
        {/* 새 글 만들기는 편집 화면과 함께 추가합니다 (#38). */}
      </div>
      <Suspense fallback={<p className="text-body text-muted">글 목록을 불러오는 중입니다.</p>}>
        <PostTable {...props} />
      </Suspense>
    </>
  );
}
