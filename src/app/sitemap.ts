import type { MetadataRoute } from "next";

import {
  getLatestPosts,
  getPostsPage,
  HOME_POST_COUNT,
  latestModifiedAt,
} from "@/lib/content/posts";
import { absoluteUrl, postPath } from "@/lib/site";

// 공개 글과 목록 페이지. 글이 발행·수정되면 CONTENT_CACHE_TAG 재검증으로 함께 갱신됩니다.
// 모든 데이터는 캐시된 공개 글 목록 한 번의 조회에서 나옵니다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [home, first] = await Promise.all([getLatestPosts(HOME_POST_COUNT), getPostsPage(1)]);
  const pages = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) => getPostsPage(i + 2)),
  );
  const all = [first, ...pages].flatMap((page) => page.items);

  return [
    { url: absoluteUrl("/"), lastModified: latestModifiedAt(home) },
    { url: absoluteUrl("/posts"), lastModified: latestModifiedAt(first.items) },
    ...pages.map((page, i) => ({
      url: absoluteUrl(`/posts/page/${i + 2}`),
      lastModified: latestModifiedAt(page.items),
    })),
    ...all.map((post) => ({
      url: absoluteUrl(postPath(post.slug)),
      lastModified: post.modifiedAt,
    })),
  ];
}
