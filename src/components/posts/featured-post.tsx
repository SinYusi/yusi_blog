import Link from "next/link";

import type { PostListItem } from "@/lib/content/posts";
import { formatDate } from "@/lib/format";

import { TagList } from "./tag-list";

export function FeaturedPost({ post }: { post: PostListItem }) {
  return (
    <article className="relative rounded-2xl border border-border bg-surface px-5 py-6 transition-colors hover:border-border-strong md:px-8 md:py-7 lg:px-10 lg:py-9">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 font-mono text-caption text-muted md:text-meta">
        <span>
          <span className="text-date">latest</span> ·{" "}
          <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
        </span>
        <TagList tags={post.tags} />
      </div>
      <h2 className="mb-3 text-h2">
        {/* 카드 전체를 누를 수 있게 하되, 링크의 이름은 제목만 되도록 가상 요소로 영역을 넓힙니다. */}
        <Link
          href={`/posts/${post.slug}`}
          className="after:absolute after:inset-0 after:rounded-2xl"
        >
          {post.title}
        </Link>
      </h2>
      {post.summary && (
        <p className="text-body text-fg-secondary md:text-body-lg">{post.summary}</p>
      )}
    </article>
  );
}
