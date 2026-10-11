import { notFound } from "next/navigation";

import { getPostBySlug, getPublicPostSlugs } from "@/lib/content/posts";
import { formatDate } from "@/lib/format";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

/*
 * 글마다 만드는 Open Graph 이미지. 글 상세와 같은 slug로 빌드 시 정적 생성되고,
 * 조회가 'use cache'(posts 태그)라 글을 저장하면 함께 갱신됩니다.
 */
export const alt = `${SITE_NAME} 글 미리보기`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// 글 상세(page.tsx)와 같은 목록으로 미리 만듭니다. 공개 글이 없을 때의 자리표시자도 같습니다.
export async function generateStaticParams() {
  const slugs = await getPublicPostSlugs();
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: "__none__" }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPostBySlug((await params).slug);
  if (!post) notFound();

  return renderOgImage({
    eyebrow: post.series ? `series / ${post.series.name} · ${post.series.order}편` : "cat post.md",
    title: post.title,
    footer: { date: formatDate(post.publishedAt), tags: post.tags.map((tag) => tag.name) },
  });
}
