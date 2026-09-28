import "server-only";

import { and, count, desc, eq, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import { posts, postTags, series, tags } from "@/db/schema";

/*
 * 공개 페이지용 조회 함수. 모두 'use cache'로 캐시되어 빌드 시 정적 셸에 포함됩니다.
 * - 태그 CONTENT_CACHE_TAG: 2단계 CMS에서 글을 발행·수정하면 revalidateTag로 다시 생성합니다.
 * - cacheLife('hours'): 예약 발행 글이 발행 시각 이후 늦어도 한 시간 안에 보이도록 합니다.
 */
export const CONTENT_CACHE_TAG = "posts";
export const POSTS_PAGE_SIZE = 10;

// 공개 조건: 발행 상태이고 발행 시각이 지난 글
const isPublic = and(eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`));

export type PostListItem = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date;
  tags: { slug: string; name: string }[];
};

async function findPublicPosts({ limit, offset = 0 }: { limit: number; offset?: number }) {
  const rows = await getDb().query.posts.findMany({
    where: isPublic,
    orderBy: [desc(posts.publishedAt), desc(posts.id)],
    limit,
    offset,
    columns: { slug: true, title: true, summary: true, publishedAt: true },
    with: {
      postTags: { with: { tag: { columns: { slug: true, name: true } } } },
    },
  });

  return rows.map(({ postTags: links, publishedAt, ...post }): PostListItem => ({
    ...post,
    // isPublic 조건상 발행 시각은 항상 있습니다.
    publishedAt: publishedAt!,
    tags: links.map((link) => link.tag).sort((a, b) => a.name.localeCompare(b.name, "ko")),
  }));
}

export async function getLatestPosts(limit: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);

  return findPublicPosts({ limit });
}

export async function getPostsPage(page: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);

  const [[{ total }], items] = await Promise.all([
    getDb().select({ total: count() }).from(posts).where(isPublic),
    findPublicPosts({ limit: POSTS_PAGE_SIZE, offset: (page - 1) * POSTS_PAGE_SIZE }),
  ]);

  return { items, total, totalPages: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)) };
}

/** 공개된 글이 하나 이상 있는 시리즈. 공개 글 수와 최근 발행일을 함께 반환합니다. */
export async function getSeriesSummaries() {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);

  return getDb()
    .select({
      slug: series.slug,
      name: series.name,
      postCount: count(posts.id),
      latestAt: sql<Date>`max(${posts.publishedAt})`.mapWith(posts.publishedAt),
    })
    .from(series)
    .innerJoin(posts, and(eq(posts.seriesId, series.id), isPublic))
    .groupBy(series.id)
    .orderBy(desc(sql`max(${posts.publishedAt})`));
}

/** 공개된 글에 쓰인 태그와 공개 글 수 (초안·예약 글은 세지 않음) */
export async function getTagSummaries() {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);

  return getDb()
    .select({ slug: tags.slug, name: tags.name, postCount: count(posts.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, and(eq(posts.id, postTags.postId), isPublic))
    .groupBy(tags.id)
    .orderBy(desc(count(posts.id)), tags.name);
}
