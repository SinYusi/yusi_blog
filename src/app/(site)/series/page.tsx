import type { Metadata } from "next";
import Link from "next/link";

import { getPublicSeries, latestPublishedAt } from "@/lib/content/posts";
import { formatDate } from "@/lib/format";
import { pageMetadata, seriesPath } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: "시리즈", path: "/series" });

/** 공개 글이 있는 시리즈 목록. 최근 글을 발행한 시리즈부터 보여 줍니다. */
export default async function SeriesListPage() {
  const seriesList = await getPublicSeries();

  return (
    <>
      <section className="flex flex-col gap-4 pt-11 pb-8 md:pt-14 lg:pt-16">
        <p className="font-mono text-meta text-muted">
          <span className="text-accent">$</span> ls series/
        </p>
        <h1 className="text-h1">시리즈</h1>
        <p className="text-body text-muted">주제별로 이어지는 글 묶음</p>
      </section>

      {seriesList.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 pb-16 md:gap-6 lg:grid-cols-2">
          {seriesList.map((series) => (
            <article
              key={series.slug}
              className="relative flex flex-col gap-3 rounded-2xl border border-border bg-surface px-5 py-6 transition-colors hover:border-border-strong md:px-8 md:py-8"
            >
              <p className="font-mono text-caption text-muted">
                series · {series.posts.length}편 · 최근{" "}
                <time dateTime={latestPublishedAt(series).toISOString()}>
                  {formatDate(latestPublishedAt(series))}
                </time>
              </p>
              <h2 className="text-h2">
                {/* 카드 전체를 누를 수 있게 하되, 링크의 이름은 시리즈 이름만 되도록 가상 요소로 영역을 넓힙니다. */}
                <Link
                  href={seriesPath(series.slug)}
                  className="after:absolute after:inset-0 after:rounded-2xl"
                >
                  {series.name}
                </Link>
              </h2>
              {series.description && (
                <p className="text-body text-fg-secondary">{series.description}</p>
              )}
              <ol className="mt-1 flex list-decimal flex-col gap-2 border-t border-border pt-4 pl-5 text-meta text-muted">
                {series.posts.map((post) => (
                  <li key={post.slug}>{post.title}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      ) : (
        <p className="pb-16 text-body text-muted">아직 공개된 시리즈가 없습니다.</p>
      )}
    </>
  );
}
