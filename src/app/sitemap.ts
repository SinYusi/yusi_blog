import type { MetadataRoute } from "next";

import { getPostsPage, getSitemapPosts } from "@/lib/content/posts";
import { absoluteUrl, postPath } from "@/lib/site";

// 공개 글과 목록 페이지. 글이 발행·수정되면 CONTENT_CACHE_TAG 재검증으로 함께 갱신됩니다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, { totalPages }] = await Promise.all([getSitemapPosts(), getPostsPage(1)]);
  const latest = posts[0]?.publishedAt;

  const listPages = Array.from({ length: totalPages - 1 }, (_, i) => ({
    url: absoluteUrl(`/posts/page/${i + 2}`),
  }));

  return [
    { url: absoluteUrl("/"), lastModified: latest },
    { url: absoluteUrl("/posts"), lastModified: latest },
    ...listPages,
    ...posts.map((post) => ({
      url: absoluteUrl(postPath(post.slug)),
      lastModified: post.modifiedAt,
    })),
  ];
}
