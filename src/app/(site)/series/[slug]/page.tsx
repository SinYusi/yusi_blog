import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicSeries } from "@/lib/content/posts";
import { formatDate } from "@/lib/format";
import { pageMetadata, postPath, seriesPath, slugParam } from "@/lib/site";

/*
 * 시리즈 상세. 공개 글이 있는 시리즈를 빌드 시 모두 정적 생성합니다.
 * Cache Components 모드에서는 최소 하나를 반환해야 하므로, 시리즈가 없을 때는 자리표시자를 반환하고 404로 처리합니다.
 */
export async function generateStaticParams() {
  const seriesList = await getPublicSeries();
  return seriesList.length > 0
    ? seriesList.map((series) => ({ slug: series.slug }))
    : [{ slug: "__none__" }];
}

async function findSeries(slug: string) {
  return (await getPublicSeries()).find((series) => series.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/series/[slug]">): Promise<Metadata> {
  const series = await findSeries(slugParam((await params).slug));
  if (!series) return {};
  return pageMetadata({
    title: series.name,
    description: series.description || `시리즈 ${series.name}의 글 ${series.posts.length}편`,
    path: seriesPath(series.slug),
  });
}

export default async function SeriesPage({ params }: PageProps<"/series/[slug]">) {
  const series = await findSeries(slugParam((await params).slug));
  if (!series) notFound();

  return (
    <>
      <section className="flex flex-col gap-4 border-b border-border pt-11 pb-8 md:pt-14 lg:pt-16">
        <nav aria-label="현재 위치" className="-my-3 font-mono text-meta text-muted">
          <Link href="/series" className="inline-flex min-h-11 min-w-11 items-center hover:text-fg">
            series
          </Link>{" "}
          / {series.name}
        </nav>
        <h1 className="text-h1">{series.name}</h1>
        {series.description && (
          <p className="max-w-article text-body-lg text-fg-secondary">{series.description}</p>
        )}
        <p className="font-mono text-meta text-muted">{series.posts.length}편 · 순서대로</p>
      </section>

      {/* 순번 원과 세로선으로 읽는 순서를 보여 줍니다. 마지막 글에는 선을 잇지 않습니다. */}
      <ol className="max-w-article pt-8 pb-16 md:pt-10">
        {series.posts.map((post, i) => (
          <li
            key={post.slug}
            className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 md:gap-x-5"
          >
            <div className="flex flex-col items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-accent font-mono text-meta font-bold text-accent">
                {post.order}
                <span className="sr-only">편</span>
              </span>
              {i < series.posts.length - 1 && (
                <span aria-hidden="true" className="w-0.5 grow bg-border" />
              )}
            </div>
            <div className="flex flex-col gap-2 pt-2 pb-9">
              <time
                dateTime={post.publishedAt.toISOString()}
                className="font-mono text-caption text-date"
              >
                {formatDate(post.publishedAt)}
              </time>
              <h2 className="text-h3">
                {/* 항목 전체를 누를 수 있게 하되, 링크의 이름은 제목만 되도록 가상 요소로 영역을 넓힙니다. */}
                <Link
                  href={postPath(post.slug)}
                  className="after:absolute after:inset-0 hover:text-accent-hover"
                >
                  {post.title}
                </Link>
              </h2>
              {post.summary && <p className="text-body text-muted">{post.summary}</p>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
