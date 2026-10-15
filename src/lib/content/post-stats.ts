import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { posts } from "@/db/schema";

import { isPublic } from "./posts";

/*
 * 글 조회수·좋아요(ADR-0016). posts의 view_count·like_count를 원자적으로 바꿉니다.
 * - 공개 글에만 적용합니다(초안·예약 글의 id로 요청하면 null).
 * - updated_at은 수정할 때마다 자동으로 바뀌므로($onUpdate) 기존 값을 그대로 넣어, 카운터가 글 수정 시각
 *   (sitemap·RSS·JSON-LD)에 섞이지 않게 합니다. 공개 페이지 캐시(posts 태그)도 무효화하지 않습니다.
 */
export type PostStats = { views: number; likes: number };

const stats = { views: posts.viewCount, likes: posts.likeCount };
const keepUpdatedAt = { updatedAt: sql`${posts.updatedAt}` };

export async function getPostStats(id: number): Promise<PostStats | null> {
  const [row] = await getDb()
    .select(stats)
    .from(posts)
    .where(and(eq(posts.id, id), isPublic))
    .limit(1);
  return row ?? null;
}

export async function addPostView(id: number): Promise<PostStats | null> {
  const [row] = await getDb()
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1`, ...keepUpdatedAt })
    .where(and(eq(posts.id, id), isPublic))
    .returning(stats);
  return row ?? null;
}

/** 좋아요 +1 또는 −1. 0 아래로 내려가지 않습니다(DB 제약과 같은 규칙). */
export async function changePostLike(id: number, delta: 1 | -1): Promise<PostStats | null> {
  const [row] = await getDb()
    .update(posts)
    .set({ likeCount: sql`greatest(${posts.likeCount} + ${delta}, 0)`, ...keepUpdatedAt })
    .where(and(eq(posts.id, id), isPublic))
    .returning(stats);
  return row ?? null;
}

/** 경로의 글 id. 양의 정수(Postgres integer 범위)만 받습니다. */
export function parsePostId(value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2_147_483_647 ? id : null;
}

/**
 * 카운터를 바꾸는 요청이 이 사이트 페이지에서 왔는지. 다른 사이트가 <form>이나 no-cors 요청으로 방문자 브라우저마다
 * 대신 보내 숫자를 부풀리지 못하게 합니다. Sec-Fetch-Site가 없는 브라우저는 Origin을 사이트 주소와 비교합니다.
 */
export function isSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
