import { getPostsPage, getPublicSeries, latestModifiedAt } from "@/lib/content/posts";
import { absoluteUrl, escapeXml, postPath, seriesPath, tagPath } from "@/lib/site";

/*
 * 공개 글, 목록, 태그, 시리즈 페이지의 sitemap. 시리즈를 뺀 데이터는 캐시된 공개 글 목록 한 번의 조회에서 나옵니다.
 * 운영(Vercel)에서 /sitemap.xml 경로의 정적 결과는 메타데이터 라우트(sitemap.ts)든 Route Handler든
 * updateTag('posts')로 무효화되지 않고 남아(#59), RSS와 같은 Route Handler를 다른 경로(SITEMAP_PATH)에 둡니다.
 * 데이터 조회가 'use cache'로 캐시되므로 빌드 시 정적 응답으로 생성되고, 글을 저장하면 RSS와 함께 갱신됩니다.
 */
export async function GET() {
  const first = await getPostsPage(1);
  const pages = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) => getPostsPage(i + 2)),
  );
  const all = [first, ...pages].flatMap((page) => page.items);
  const seriesList = await getPublicSeries();
  const tagSlugs = new Set(all.flatMap((post) => post.tags.map((tag) => tag.slug)));

  const entries = [
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
    // 태그·시리즈 페이지는 글이 그 태그·시리즈에서 빠지거나 비공개가 될 때도 바뀌는데, 그 시각은 남지 않습니다.
    // 남은 글의 시각으로는 과거로 돌아갈 수 있어 수정 시각(lastmod)을 넣지 않습니다.
    ...[
      "/tags",
      ...[...tagSlugs].map(tagPath),
      "/series",
      ...seriesList.map((s) => seriesPath(s.slug)),
    ].map((path) => ({ url: absoluteUrl(path), lastModified: undefined })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(({ url, lastModified }) =>
      [
        "<url>",
        `<loc>${escapeXml(url)}</loc>`,
        lastModified && `<lastmod>${lastModified.toISOString()}</lastmod>`,
        "</url>",
      ]
        .filter(Boolean)
        .join(""),
    ),
    "</urlset>",
  ].join("\n");

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
