import "server-only";

import { asc, desc, eq, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import { posts, series, tags } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";

/*
 * 관리자 글 목록. 관리자 화면은 캐시하지 않고 요청마다 읽습니다(SPEC 렌더링 전략).
 * 관리자 확인을 데이터 조회 함수 안에서 하므로, 호출하는 쪽이 확인을 빠뜨려도 데이터가 나가지 않습니다.
 */

/**
 * 화면에 보이는 상태. 공개 페이지와 같은 기준(isPublic)으로, 발행 시각이 지난 비초안 글만 '발행'입니다.
 */
export type AdminPostState = "draft" | "scheduled" | "published";

export const ADMIN_POST_STATES = ["draft", "scheduled", "published"] as const;

export type AdminPostRow = {
  id: number;
  slug: string;
  title: string;
  state: AdminPostState;
  publishedAt: Date | null;
  updatedAt: Date;
  viewCount: number;
  tags: string[];
};

// 공개 조건(posts.ts의 isPublic)과 같은 기준: 초안이 아니고 발행 시각이 지난 글만 '발행'입니다.
// 상태가 published여도 발행 시각이 미래면 아직 공개되지 않으므로 '예약'으로 봅니다.
function toState(status: "draft" | "scheduled" | "published", publishedAt: Date | null, now: Date) {
  if (status === "draft") return "draft";
  return publishedAt && publishedAt <= now ? "published" : "scheduled";
}

export async function getAdminPosts({
  state,
  query,
}: {
  state: AdminPostState | null;
  query: string;
}) {
  await requireAdmin();

  const rows = await getDb().query.posts.findMany({
    orderBy: [desc(posts.updatedAt), desc(posts.id)],
    columns: {
      id: true,
      slug: true,
      title: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      viewCount: true,
    },
    with: { postTags: { with: { tag: { columns: { name: true } } } } },
  });

  const now = new Date();
  const all = rows.map(({ postTags: links, status, ...post }): AdminPostRow => ({
    ...post,
    state: toState(status, post.publishedAt, now),
    tags: links.map((link) => link.tag.name).sort((a, b) => a.localeCompare(b, "ko")),
  }));

  const counts = { all: all.length, draft: 0, scheduled: 0, published: 0 };
  for (const post of all) counts[post.state] += 1;

  const keyword = query.trim().toLowerCase();
  const items = all.filter(
    (post) =>
      (!state || post.state === state) && (!keyword || post.title.toLowerCase().includes(keyword)),
  );

  return { items, counts };
}

export type AdminPostDetail = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  /** 에디터 원본. 에디터가 생기기 전에 HTML로만 넣은 글(시드 등)은 null입니다. */
  content: unknown;
  status: "draft" | "published" | "scheduled";
  state: AdminPostState;
  publishedAt: Date | null;
  updatedAt: Date;
  seriesId: number | null;
  seriesOrder: number | null;
  tags: string[];
};

/** 편집 화면용 글 하나. 없으면 null입니다. */
export async function getAdminPost(id: number): Promise<AdminPostDetail | null> {
  await requireAdmin();

  const post = await getDb().query.posts.findFirst({
    where: eq(posts.id, id),
    columns: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      seriesId: true,
      seriesOrder: true,
    },
    with: { postTags: { with: { tag: { columns: { name: true } } } } },
  });
  if (!post) return null;

  const { postTags: links, ...rest } = post;
  return {
    ...rest,
    state: toState(post.status, post.publishedAt, new Date()),
    tags: links.map((link) => link.tag.name).sort((a, b) => a.localeCompare(b, "ko")),
  };
}

export type SeriesOption = {
  id: number;
  name: string;
  /** 이 시리즈에서 이미 쓰는 순번과 그 글 (순번 중복을 화면에서 미리 알리는 데 씀) */
  orders: { order: number; postId: number; title: string }[];
};

export type PostFormOptions = { series: SeriesOption[]; tags: string[] };

/** 글 편집 화면의 선택지: 시리즈(사용 중인 순번 포함)와 기존 태그 이름 */
export async function getPostFormOptions(): Promise<PostFormOptions> {
  await requireAdmin();

  const db = getDb();
  const [seriesRows, orderRows, tagRows] = await Promise.all([
    db.select({ id: series.id, name: series.name }).from(series).orderBy(asc(series.name)),
    db
      .select({
        seriesId: posts.seriesId,
        order: posts.seriesOrder,
        postId: posts.id,
        title: posts.title,
      })
      .from(posts)
      .where(isNotNull(posts.seriesId))
      .orderBy(asc(posts.seriesOrder)),
    db.select({ name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);

  return {
    series: seriesRows.map((item) => ({
      ...item,
      orders: orderRows.flatMap((row) =>
        row.seriesId === item.id && row.order !== null
          ? [{ order: row.order, postId: row.postId, title: row.title }]
          : [],
      ),
    })),
    tags: tagRows.map((row) => row.name).sort((a, b) => a.localeCompare(b, "ko")),
  };
}
