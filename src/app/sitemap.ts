import type { MetadataRoute } from "next";

import { getPostsPage, latestModifiedAt } from "@/lib/content/posts";
import { absoluteUrl, postPath } from "@/lib/site";

// 공개 글과 목록 페이지. 글이 발행·수정되면 CONTENT_CACHE_TAG 재검증으로 함께 갱신됩니다.
// 모든 데이터는 캐시된 공개 글 목록 한 번의 조회에서 나옵니다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const first = await getPostsPage(1);
  const pages = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) => getPostsPage(i + 2)),
  );
  const all = [first, ...pages].flatMap((page) => page.items);

  return [
    // 홈은 최근 글뿐 아니라 전체 공개 글로 센 시리즈·태그 글 수도 보여 주므로 전체 기준입니다.
    { url: absoluteUrl("/"), lastModified: latestModifiedAt(all) },
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
