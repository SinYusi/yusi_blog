import type { PostListItem } from "@/lib/content/posts";

import { Pagination } from "./pagination";
import { PostRow } from "./post-row";

export function PostsPageView({
  items,
  total,
  page,
  totalPages,
}: {
  items: PostListItem[];
  total: number;
  page: number;
  totalPages: number;
}) {
  return (
    <>
      <section className="flex flex-col gap-4 pt-11 pb-8 md:pt-14 lg:pt-16">
        <p className="font-mono text-meta text-muted">
          <span className="text-accent">$</span> ls posts/
        </p>
        <h1 className="text-h1">모든 글</h1>
        <p className="text-body text-muted">
          {total}개의 글{totalPages > 1 && ` · ${page}/${totalPages} 페이지`}
        </p>
      </section>

      <div className="border-t border-border pb-6">
        {items.length > 0 ? (
          items.map((post) => <PostRow key={post.slug} post={post} headingLevel="h2" />)
        ) : (
          <p className="py-10 text-body text-muted">아직 발행된 글이 없습니다.</p>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} />
    </>
  );
}
