import Link from "next/link";

import type { PostListItem } from "@/lib/content/posts";
import { formatDate } from "@/lib/format";

import { TagList } from "./tag-list";

export function PostRow({
  post,
  headingLevel = "h3",
}: {
  post: PostListItem;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <article className="relative flex flex-col gap-2 border-b border-border py-5 md:grid md:grid-cols-[110px_minmax(0,1fr)] md:gap-x-5 md:py-6 lg:grid-cols-[120px_minmax(0,1fr)]">
      <time
        dateTime={post.publishedAt.toISOString()}
        className="font-mono text-caption text-date md:pt-2 md:text-meta"
      >
        {formatDate(post.publishedAt)}
      </time>
      <div className="flex flex-col gap-2">
        <Heading className="text-h3">
          {/* 행 전체를 누를 수 있게 해 터치 영역을 44px 이상으로 둡니다. 링크 이름은 제목만 됩니다. */}
          <Link
            href={`/posts/${post.slug}`}
            className="after:absolute after:inset-0 hover:text-accent-hover"
          >
            {post.title}
          </Link>
        </Heading>
        {post.summary && <p className="text-body text-muted">{post.summary}</p>}
        <TagList tags={post.tags} />
      </div>
    </article>
  );
}
