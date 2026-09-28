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
    <article className="flex flex-col gap-2 border-b border-border py-5 md:grid md:grid-cols-[110px_minmax(0,1fr)] md:gap-x-5 md:py-6 lg:grid-cols-[120px_minmax(0,1fr)]">
      <time
        dateTime={post.publishedAt.toISOString()}
        className="font-mono text-caption text-date md:pt-1.5 md:text-meta"
      >
        {formatDate(post.publishedAt)}
      </time>
      <div className="flex flex-col gap-2">
        <Heading className="text-h3">
          <Link href={`/posts/${post.slug}`} className="hover:text-accent-hover">
            {post.title}
          </Link>
        </Heading>
        {post.summary && <p className="text-body text-muted">{post.summary}</p>}
        <TagList tags={post.tags} />
      </div>
    </article>
  );
}
