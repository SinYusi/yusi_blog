import Link from "next/link";

import type { PostDetail } from "@/lib/content/posts";

export function SeriesNav({ series }: { series: NonNullable<PostDetail["series"]> }) {
  if (!series.prev && !series.next) return null;

  const cardClass =
    "block rounded-xl border border-border px-5 py-4 transition-colors hover:border-border-strong";

  return (
    <nav
      aria-label={`시리즈 ${series.name}의 이전 글, 다음 글`}
      className="mt-14 grid grid-cols-1 gap-3 border-t border-border pt-7 md:grid-cols-2"
    >
      {series.prev ? (
        <Link href={`/posts/${series.prev.slug}`} rel="prev" className={cardClass}>
          <span className="mb-1.5 block font-mono text-caption text-muted">← 이전 글</span>
          <span className="block text-body font-semibold">{series.prev.title}</span>
        </Link>
      ) : (
        <span className="hidden md:block" />
      )}
      {series.next && (
        <Link
          href={`/posts/${series.next.slug}`}
          rel="next"
          className={`${cardClass} md:text-right`}
        >
          <span className="mb-1.5 block font-mono text-caption text-muted">다음 글 →</span>
          <span className="block text-body font-semibold">{series.next.title}</span>
        </Link>
      )}
    </nav>
  );
}
