import "server-only";

import { and, asc, count, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import { posts, postTags, series, tags } from "@/db/schema";

import { renderPostHtml, type TocItem } from "./render";

/*
 * 공개 페이지용 조회 함수. 모두 'use cache'로 캐시되어 빌드 시 정적 셸에 포함됩니다.
 * - 태그 CONTENT_CACHE_TAG: 2단계 CMS에서 글을 발행·수정하면 revalidateTag로 다시 생성합니다.
 * - cacheLife('hours'): 한 시간이 지난 뒤 들어온 요청이 백그라운드 재생성을 시작합니다. 그래서 예약 글은 발행 시각
 *   이후 대략 한 시간 안팎에 보이지만 정확한 시각은 보장하지 않습니다. 정시 공개가 필요해지면 2단계 CMS에서
 *   발행 시각에 revalidateTag(CONTENT_CACHE_TAG)를 호출합니다.
 */
export const CONTENT_CACHE_TAG = "posts";
export const POSTS_PAGE_SIZE = 10;

/*
 * 공개 조건: 발행(published) 또는 예약(scheduled) 상태이고 발행 시각이 지난 글.
 * 예약 글을 발행 시각에 published로 바꾸는 작업을 따로 두지 않고, 조회 조건으로 공개 여부를 정합니다.
 */
const isPublic = and(
  inArray(posts.status, ["published", "scheduled"]),
  lte(posts.publishedAt, sql`now()`),
);

export type PostListItem = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date;
  /** 발행 시각과 수정 시각 중 늦은 쪽. 발행 전에 고친 예약 글도 발행 시각보다 앞서지 않습니다 (sitemap, RSS) */
  modifiedAt: Date;
  tags: { slug: string; name: string }[];
};

/*
 * 공개 글 목록 전체를 한 번만 조회해 캐시하고, 홈·목록 페이지는 여기서 잘라 씁니다.
 * 빌드 리전이 DB와 멀어도 목록 페이지 수만큼 쿼리가 늘지 않게 합니다 (ADR-0005 "빌드 리전").
 * 목록에는 본문 없이 제목·요약·태그만 담으므로 글이 수백 개여도 부담이 작습니다.
 */
async function getPublicPostList() {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_CACHE_TAG);

  const rows = await getDb().query.posts.findMany({
    where: isPublic,
    orderBy: [desc(posts.publishedAt), desc(posts.id)],
    columns: { slug: true, title: true, summary: true, publishedAt: true, updatedAt: true },
    with: {
      postTags: { with: { tag: { columns: { slug: true, name: true } } } },
    },
  });

  return rows.map(({ postTags: links, publishedAt, updatedAt, ...post }): PostListItem => ({
    ...post,
    // isPublic 조건상 발행 시각은 항상 있습니다.
    publishedAt: publishedAt!,
    modifiedAt: latestOf(publishedAt!, updatedAt),
    tags: links.map((link) => link.tag).sort((a, b) => a.name.localeCompare(b.name, "ko")),
  }));
}

export async function getLatestPosts(limit: number) {
  return (await getPublicPostList()).slice(0, limit);
}

export async function getPostsPage(page: number) {
  const all = await getPublicPostList();
  const start = (page - 1) * POSTS_PAGE_SIZE;
  return {
    items: all.slice(start, start + POSTS_PAGE_SIZE),
    total: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / POSTS_PAGE_SIZE)),
  };
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

/** 정적 생성할 공개 글의 slug 목록 */
export async function getPublicPostSlugs() {
  // 목록 조회 결과를 재사용해 빌드 쿼리를 늘리지 않습니다.
  return (await getPublicPostList()).map((post) => post.slug);
}

function latestOf(a: Date, b: Date) {
  return a > b ? a : b;
}

/** 목록에 담긴 글 중 가장 늦은 수정 시각 (sitemap의 목록 lastModified, RSS lastBuildDate) */
export function latestModifiedAt(items: PostListItem[]) {
  return items.reduce<Date | undefined>(
    (latest, post) => (latest ? latestOf(latest, post.modifiedAt) : post.modifiedAt),
    undefined,
  );
}

export type SeriesNeighbor = { slug: string; title: string };

export type PostDetail = PostListItem & {
  html: string;
  toc: TocItem[];
  series: {
    slug: string;
    name: string;
    order: number;
    publicCount: number;
    prev: SeriesNeighbor | null;
    next: SeriesNeighbor | null;
  } | null;
};

/** 공개된 글의 상세. 공개되지 않은 글(초안, 예약, 없는 slug)은 null입니다. 본문 렌더링도 캐시에 포함됩니다. */
export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  "use cache";
  cacheTag(CONTENT_CACHE_TAG, `post:${slug}`);

  const post = await getDb().query.posts.findFirst({
    where: and(eq(posts.slug, slug), isPublic),
    columns: {
      slug: true,
      title: true,
      summary: true,
      contentHtml: true,
      publishedAt: true,
      updatedAt: true,
      seriesId: true,
      seriesOrder: true,
    },
    with: {
      series: { columns: { slug: true, name: true } },
      postTags: { with: { tag: { columns: { slug: true, name: true } } } },
    },
  });
  if (!post) {
    // 예약 글은 발행 시각 전에 조회되면 null이 됩니다. 발행 뒤 404가 오래 남지 않도록 짧게 캐시합니다.
    cacheLife("minutes");
    return null;
  }
  cacheLife("hours");

  let seriesInfo: PostDetail["series"] = null;
  if (post.series && post.seriesId !== null && post.seriesOrder !== null) {
    // 같은 시리즈의 공개된 글만 순서대로 가져와 이전·다음 글을 정합니다 (초안·예약 글로 가는 링크 방지).
    // 표시하는 편 번호는 저장된 series_order를 써서, 중간 글의 공개 여부에 따라 번호가 바뀌지 않게 합니다.
    const siblings = await getDb()
      .select({ slug: posts.slug, title: posts.title, order: posts.seriesOrder })
      .from(posts)
      .where(and(eq(posts.seriesId, post.seriesId), isPublic))
      .orderBy(asc(posts.seriesOrder));
    const position = siblings.findIndex((sibling) => sibling.slug === post.slug);
    const pick = (i: number) =>
      siblings[i] ? { slug: siblings[i].slug, title: siblings[i].title } : null;
    seriesInfo = {
      slug: post.series.slug,
      name: post.series.name,
      order: post.seriesOrder,
      publicCount: siblings.length,
      prev: pick(position - 1),
      next: pick(position + 1),
    };
  }

  const { html, toc } = await renderPostHtml(post.contentHtml);

  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    publishedAt: post.publishedAt!,
    modifiedAt: latestOf(post.publishedAt!, post.updatedAt),
    tags: post.postTags.map((link) => link.tag).sort((a, b) => a.name.localeCompare(b.name, "ko")),
    html,
    toc,
    series: seriesInfo,
  };
}
