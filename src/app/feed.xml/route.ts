import { getLatestPosts, latestModifiedAt } from "@/lib/content/posts";
import { FEED_PATH, SITE_DESCRIPTION, SITE_NAME, absoluteUrl, postPath } from "@/lib/site";

/*
 * RSS 2.0 피드. 최근 공개 글의 요약을 담고 본문은 사이트에서 읽도록 링크합니다.
 * 데이터 조회가 'use cache'로 캐시되므로 빌드 시 정적 응답으로 생성됩니다.
 */
const FEED_ITEM_COUNT = 20;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getLatestPosts(FEED_ITEM_COUNT);
  const home = absoluteUrl("/");

  const items = posts.map((post) => {
    const url = absoluteUrl(postPath(post.slug));
    const categories = post.tags.map((tag) => `<category>${escapeXml(tag.name)}</category>`);
    return [
      "<item>",
      `<title>${escapeXml(post.title)}</title>`,
      `<link>${escapeXml(url)}</link>`,
      `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `<pubDate>${post.publishedAt.toUTCString()}</pubDate>`,
      post.summary && `<description>${escapeXml(post.summary)}</description>`,
      ...categories,
      "</item>",
    ]
      .filter(Boolean)
      .join("");
  });

  // lastBuildDate는 빌드 시각이 아니라 피드에 담긴 글의 가장 늦은 수정 시각입니다. 데이터가 같으면 응답도 같고,
  // 글을 수정하면 함께 바뀝니다.
  const lastModified = latestModifiedAt(posts);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(SITE_NAME)}</title>`,
    `<link>${escapeXml(home)}</link>`,
    `<description>${escapeXml(SITE_DESCRIPTION)}</description>`,
    "<language>ko</language>",
    `<atom:link href="${escapeXml(absoluteUrl(FEED_PATH))}" rel="self" type="application/rss+xml"/>`,
    lastModified && `<lastBuildDate>${lastModified.toUTCString()}</lastBuildDate>`,
    ...items,
    "</channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
