import "server-only";

import { desc } from "drizzle-orm";

import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";

/*
 * 관리자 글 목록. 관리자 화면은 캐시하지 않고 요청마다 읽습니다(SPEC 렌더링 전략).
 * 관리자 확인을 데이터 조회 함수 안에서 하므로, 호출하는 쪽이 확인을 빠뜨려도 데이터가 나가지 않습니다.
 */

/**
 * 화면에 보이는 상태. 예약 글은 발행 시각이 지나면 공개 페이지와 같은 기준(isPublic)으로 '발행'입니다.
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

function toState(status: "draft" | "scheduled" | "published", publishedAt: Date | null, now: Date) {
  if (status === "draft") return "draft";
  if (status === "scheduled" && (!publishedAt || publishedAt > now)) return "scheduled";
  return "published";
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
