import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostRow } from "@/components/posts/post-row";
import { getTagPosts, getTagSummaries } from "@/lib/content/posts";
import { pageMetadata, slugParam, tagPath } from "@/lib/site";

/*
 * 태그별 글. 공개 글이 있는 태그를 빌드 시 모두 정적 생성합니다.
 * Cache Components 모드에서는 최소 하나를 반환해야 하므로, 태그가 없을 때는 자리표시자를 반환하고 404로 처리합니다.
 * ponytail: 페이지네이션 없음, 한 태그의 글이 목록 한 페이지(10개)를 넘기 시작하면 /posts처럼 나눔
 */
export async function generateStaticParams() {
  const tags = await getTagSummaries();
  return tags.length > 0 ? tags.map((tag) => ({ slug: tag.slug })) : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/tags/[slug]">): Promise<Metadata> {
  const data = await getTagPosts(slugParam((await params).slug));
  if (!data) return {};
  return pageMetadata({
    title: `#${data.tag.name}`,
    description: `#${data.tag.name} 태그가 붙은 글 ${data.items.length}개`,
    path: tagPath(data.tag.slug),
  });
}

export default async function TagPage({ params }: PageProps<"/tags/[slug]">) {
  const data = await getTagPosts(slugParam((await params).slug));
  if (!data) notFound();
  const { tag, items } = data;

  return (
    <>
      <section className="flex flex-col gap-4 pt-11 pb-8 md:pt-14 lg:pt-16">
        <nav aria-label="현재 위치" className="-my-3 font-mono text-meta text-muted">
          <Link href="/tags" className="inline-flex min-h-11 min-w-11 items-center hover:text-fg">
            tags
          </Link>{" "}
          / {tag.name}
        </nav>
        <h1 className="text-h1 break-words">
          <span className="text-accent">#</span>
          {tag.name}
        </h1>
        <p className="text-body text-muted">{items.length}개의 글</p>
      </section>

      <div className="border-t border-border pb-16">
        {items.map((post) => (
          <PostRow key={post.slug} post={post} headingLevel="h2" />
        ))}
      </div>
    </>
  );
}
