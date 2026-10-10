import type { Metadata } from "next";
import Link from "next/link";

import { FeaturedPost } from "@/components/posts/featured-post";
import { PostRow } from "@/components/posts/post-row";
import { getLatestPosts, getPublicSeries, getTagSummaries } from "@/lib/content/posts";
import { pageMetadata, seriesPath, tagPath } from "@/lib/site";

const HOME_POST_COUNT = 6;

export const metadata: Metadata = pageMetadata({ path: "/" });

export default async function Home() {
  const [latest, seriesList, tagList] = await Promise.all([
    getLatestPosts(HOME_POST_COUNT),
    getPublicSeries(),
    getTagSummaries(),
  ]);
  const [featured, ...rest] = latest;

  return (
    <>
      <section className="flex flex-col gap-4 pt-11 pb-9 md:pt-14 md:pb-11 lg:pt-20 lg:pb-16">
        <p className="font-mono text-meta text-muted">
          <span className="text-accent">$</span> cat README.md
        </p>
        <h1 className="text-display">
          만들면서 부딪힌 문제를
          <br className="hidden md:block" /> <span className="text-accent">커밋처럼</span> 기록하는
          프론트엔드 로그
        </h1>
        <p className="max-w-article text-body-lg text-muted">
          원인을 추적한 과정, 내린 결정, 개선 전후의 수치를 남깁니다.
        </p>
      </section>

      {featured ? (
        <>
          <FeaturedPost post={featured} />

          <div className="grid grid-cols-1 gap-x-6 pt-9 pb-14 md:pt-10 lg:grid-cols-12 lg:pt-14">
            <section aria-labelledby="recent-heading" className="lg:col-span-8">
              <h2 id="recent-heading" className="font-mono text-meta font-medium text-muted">
                <span className="text-accent">$</span> git log --oneline
              </h2>
              {rest.map((post) => (
                <PostRow key={post.slug} post={post} />
              ))}
              <Link
                href="/posts"
                className="mt-6 inline-flex min-h-11 items-center font-mono text-meta text-accent hover:text-accent-hover"
              >
                모든 글 보기 →
              </Link>
            </section>

            <aside className="mt-12 flex flex-col gap-10 md:flex-row md:gap-16 lg:col-span-3 lg:col-start-10 lg:mt-7 lg:flex-col lg:gap-10">
              {seriesList.length > 0 && (
                <section aria-labelledby="series-heading">
                  <h2
                    id="series-heading"
                    className="mb-4 font-mono text-meta font-medium text-muted"
                  >
                    {"// series"}
                  </h2>
                  <ul className="-my-2 flex flex-col text-body">
                    {seriesList.map((s) => (
                      <li key={s.slug} className="flex items-center gap-1.5">
                        <Link
                          href={seriesPath(s.slug)}
                          className="inline-flex min-h-11 items-center hover:text-accent-hover"
                        >
                          {s.name}
                        </Link>{" "}
                        <span className="font-mono text-caption text-muted">
                          {s.posts.length}편
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {tagList.length > 0 && (
                <section aria-labelledby="tags-heading">
                  <h2 id="tags-heading" className="mb-4 font-mono text-meta font-medium text-muted">
                    {"// tags"}
                  </h2>
                  <ul className="flex flex-wrap gap-2 font-mono text-caption">
                    {tagList.map((tag) => (
                      <li key={tag.slug}>
                        <Link
                          href={tagPath(tag.slug)}
                          className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-3 py-1 hover:border-border-strong hover:text-accent-hover"
                        >
                          #{tag.name}&nbsp;<span className="text-muted">{tag.postCount}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        </>
      ) : (
        <p className="pb-16 text-body text-muted">아직 발행된 글이 없습니다.</p>
      )}
    </>
  );
}
