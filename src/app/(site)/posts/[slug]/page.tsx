import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { CodeCopy } from "@/components/post/code-copy";
import { SeriesNav } from "@/components/post/series-nav";
import { TableOfContents } from "@/components/post/table-of-contents";
import { TagList } from "@/components/posts/tag-list";
import {
  getPostBySlug,
  getPublicPostSlugs,
  getRedirectedSlug,
  type PostDetail,
} from "@/lib/content/posts";
import { formatDate } from "@/lib/format";
import { SITE_AUTHOR, SITE_NAME, absoluteUrl, pageMetadata, postPath } from "@/lib/site";

/*
 * 공개된 글을 빌드 시 모두 정적 생성합니다. Cache Components 모드에서는 최소 하나를 반환해야 하므로,
 * 공개 글이 없을 때는 자리표시자를 반환하고 페이지에서 404로 처리합니다.
 */
export async function generateStaticParams() {
  const slugs = await getPublicPostSlugs();
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: "__none__" }];
}

export async function generateMetadata({ params }: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const post = await getPostBySlug((await params).slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.summary || undefined,
    path: postPath(post.slug),
    openGraph: {
      type: "article",
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.modifiedAt.toISOString(),
      authors: [SITE_AUTHOR.url],
      tags: post.tags.map((tag) => tag.name),
    },
  });
}

/** 검색 엔진용 구조화 데이터 (schema.org BlogPosting) */
function PostJsonLd({ post }: { post: PostDetail }) {
  const url = absoluteUrl(postPath(post.slug));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    ...(post.summary && { description: post.summary }),
    url,
    mainEntityOfPage: url,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.modifiedAt.toISOString(),
    inLanguage: "ko-KR",
    author: { "@type": "Person", name: SITE_AUTHOR.name, url: SITE_AUTHOR.url },
    isPartOf: { "@type": "Blog", name: SITE_NAME, url: absoluteUrl("/") },
    ...(post.tags.length > 0 && { keywords: post.tags.map((tag) => tag.name) }),
  };

  return (
    <script
      type="application/ld+json"
      // 제목·요약에 </script>가 들어가도 스크립트가 끝나지 않도록 <를 이스케이프합니다.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

export default async function PostPage({ params }: PageProps<"/posts/[slug]">) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) {
    // 발행된 글의 slug를 바꾸면 이전 주소로 들어온 방문자를 새 주소로 영구 이동(308)시킵니다 (ADR-0012).
    const current = await getRedirectedSlug(slug);
    if (current) permanentRedirect(postPath(current));
    notFound();
  }

  const hasToc = post.toc.length > 0;

  return (
    <div className="grid grid-cols-1 gap-x-6 pt-8 pb-16 md:pt-12 lg:grid-cols-12 lg:pt-16">
      <PostJsonLd post={post} />
      <article className="min-w-0 lg:col-span-8">
        <header className="border-b border-border pb-6 md:pb-8">
          {post.series && (
            <p className="mb-4 font-mono text-caption text-muted md:text-meta">
              series / <span className="text-accent">{post.series.name}</span> · {post.series.order}
              편
            </p>
          )}
          <h1 className="mb-5 text-h1">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-caption text-muted md:text-meta">
            <time dateTime={post.publishedAt.toISOString()} className="text-date">
              {formatDate(post.publishedAt)}
            </time>
            <TagList tags={post.tags} />
          </div>
        </header>

        {hasToc && (
          <details className="group mt-7 rounded-xl border border-border bg-surface lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 font-mono text-meta text-muted [&::-webkit-details-marker]:hidden">
              {"// on this page"}
              <svg
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <ol className="flex flex-col px-4 pb-3 text-body">
              {post.toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-11 items-center text-muted hover:text-fg"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}

        <CodeCopy>
          {/* 본문은 renderPostHtml에서 허용 목록으로 정화(sanitize)한 HTML입니다. */}
          <div className="prose-article" dangerouslySetInnerHTML={{ __html: post.html }} />
        </CodeCopy>

        {post.series && <SeriesNav series={post.series} />}
      </article>

      {hasToc && (
        <aside className="hidden lg:col-span-3 lg:col-start-10 lg:block">
          <div className="sticky top-8 pt-32">
            <TableOfContents items={post.toc} />
          </div>
        </aside>
      )}
    </div>
  );
}
