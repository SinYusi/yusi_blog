import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { PostsPageView } from "@/components/posts/posts-page-view";
import { getPostsPage } from "@/lib/content/posts";
import { pageMetadata } from "@/lib/site";

/*
 * 2페이지부터의 글 목록. 1페이지는 /posts가 대표 주소입니다.
 * Cache Components 모드에서는 generateStaticParams가 최소 하나를 반환해야 하므로 1페이지를 포함하고,
 * 1페이지는 /posts로 영구 리다이렉트합니다. 범위를 벗어난 번호는 404입니다.
 */
export async function generateStaticParams() {
  const { totalPages } = await getPostsPage(1);
  return Array.from({ length: totalPages }, (_, i) => ({ page: String(i + 1) }));
}

// 최대 6자리로 제한해 아주 큰 번호가 DB OFFSET 범위를 넘거나 Infinity가 되지 않게 합니다 (범위 밖은 404).
function parsePage(value: string) {
  return /^[1-9]\d{0,5}$/.test(value) ? Number(value) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/posts/page/[page]">): Promise<Metadata> {
  const page = parsePage((await params).page);
  return page === null
    ? {}
    : pageMetadata({ title: `모든 글 (${page}페이지)`, path: `/posts/page/${page}` });
}

export default async function PostsPageN({ params }: PageProps<"/posts/page/[page]">) {
  const page = parsePage((await params).page);
  if (page === null) notFound();
  if (page === 1) permanentRedirect("/posts");

  const { items, total, totalPages } = await getPostsPage(page);
  if (page > totalPages) notFound();

  return <PostsPageView items={items} total={total} page={page} totalPages={totalPages} />;
}
