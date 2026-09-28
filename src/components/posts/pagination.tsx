import Link from "next/link";

export function pageHref(page: number) {
  return page <= 1 ? "/posts" : `/posts/page/${page}`;
}

const itemClass =
  "flex h-11 min-w-11 items-center justify-center rounded-lg border border-border px-4";

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav
      aria-label="페이지"
      className="flex flex-wrap items-center justify-center gap-2 py-10 font-mono text-meta"
    >
      {page > 1 ? (
        <Link
          href={pageHref(page - 1)}
          rel="prev"
          className={`${itemClass} hover:border-border-strong`}
        >
          ← 이전
        </Link>
      ) : (
        <span aria-disabled="true" className={`${itemClass} text-muted opacity-60`}>
          ← 이전
        </span>
      )}
      {pages.map((n) =>
        n === page ? (
          <span
            key={n}
            aria-current="page"
            className={`${itemClass} border-accent bg-accent px-0 font-bold text-bg`}
          >
            {n}
          </span>
        ) : (
          <Link
            key={n}
            href={pageHref(n)}
            className={`${itemClass} px-0 hover:border-border-strong`}
          >
            {n}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link
          href={pageHref(page + 1)}
          rel="next"
          className={`${itemClass} hover:border-border-strong`}
        >
          다음 →
        </Link>
      ) : (
        <span aria-disabled="true" className={`${itemClass} text-muted opacity-60`}>
          다음 →
        </span>
      )}
    </nav>
  );
}
