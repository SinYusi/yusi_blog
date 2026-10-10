import type { Metadata } from "next";
import Link from "next/link";

import { getTagSummaries } from "@/lib/content/posts";
import { pageMetadata, tagPath } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: "태그", path: "/tags" });

/** 공개 글이 있는 태그 목록. 글이 많은 태그부터 보여 줍니다. */
export default async function TagsPage() {
  const tags = await getTagSummaries();

  return (
    <>
      <section className="flex flex-col gap-4 pt-11 pb-8 md:pt-14 lg:pt-16">
        <p className="font-mono text-meta text-muted">
          <span className="text-accent">$</span> ls tags/
        </p>
        <h1 className="text-h1">태그</h1>
        <p className="text-body text-muted">{tags.length}개의 태그</p>
      </section>

      {tags.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 pb-16 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {tags.map((tag) => (
            <li key={tag.slug}>
              <Link
                href={tagPath(tag.slug)}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 font-mono transition-colors hover:border-border-strong md:px-6 md:py-5"
              >
                <span className="min-w-0 text-body font-medium break-words">#{tag.name}</span>
                <span className="text-meta text-muted">
                  {tag.postCount}
                  <span className="sr-only">개의 글</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pb-16 text-body text-muted">아직 태그가 붙은 글이 없습니다.</p>
      )}
    </>
  );
}
