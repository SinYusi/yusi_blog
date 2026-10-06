import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { getDb, withTransaction, type Transaction } from "@/db";
import { posts, postSlugRedirects, postTags, series, tags } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/admin";

import {
  PAST_SCHEDULE_ERROR,
  resolvePublication,
  stableStringify,
  tagSlugFromName,
  type FieldErrors,
  type PostInput,
} from "./post-input";

/*
 * 관리자 글 쓰기(생성·수정·삭제). 관리자 확인을 이 함수들 안에서도 하므로(Data Access Layer), 호출하는 쪽이 빠뜨려도 쓰지 않습니다.
 * 형식 검사는 호출 전에 post-input.ts로 끝내고, 여기서는 DB를 봐야 아는 규칙(slug 중복, 시리즈 순번 중복)을 검사합니다.
 * 검사와 쓰기를 한 트랜잭션에서 하고, 그 사이에 다른 요청이 같은 값을 먼저 쓰면 DB 제약 위반을 같은 필드 오류로 바꿉니다.
 */

/** 저장할 본문. null이면 기존 본문을 그대로 둡니다(에디터 원본이 없는 글). empty는 실제 내용이 없는 문서인지입니다. */
export type PostContent = {
  json: unknown;
  html: string;
  empty: boolean;
  missingAlt: number;
} | null;

export type SavePostResult =
  | {
      ok: true;
      id: number;
      slug: string;
      changed: boolean;
      updatedAt: Date;
      /** 저장 전후 모두 초안이면 false. 공개 페이지에 영향이 없어 캐시를 무효화하지 않아도 됩니다. */
      affectsPublic: boolean;
    }
  | { ok: false; errors: FieldErrors; message?: string }
  | { ok: false; notFound: true }
  | { ok: false; conflict: true };

type ExistingPost = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content: unknown;
  contentHtml: string;
  status: "draft" | "published" | "scheduled";
  publishedAt: Date | null;
  seriesId: number | null;
  seriesOrder: number | null;
  updatedAt: Date;
};

/** 트랜잭션 안에서 필드 오류를 만나면 던져서 롤백합니다. */
class FieldValidationError extends Error {
  constructor(readonly errors: FieldErrors) {
    super("입력 값이 올바르지 않습니다.");
  }
}

/** DB 제약 이름 → 사용자에게 보여 줄 필드 오류 (검사와 쓰기 사이에 다른 요청이 끼어든 경우) */
const CONSTRAINT_ERRORS: Record<string, FieldErrors> = {
  posts_slug_unique: { slug: "이미 다른 글이 쓰는 주소입니다." },
  post_slug_redirects_pkey: { slug: "다른 글의 이전 주소로 쓰이고 있는 주소입니다." },
  posts_series_order_unique: { seriesOrder: "이 시리즈에서 이미 쓰는 순번입니다." },
  posts_series_id_series_id_fk: {
    seriesId: "시리즈를 찾을 수 없습니다. 목록을 새로 고친 뒤 다시 고르세요.",
  },
  tags_name_unique: { tags: "태그를 만드는 중 충돌이 났습니다. 다시 저장하세요." },
  tags_slug_unique: { tags: "태그를 만드는 중 충돌이 났습니다. 다시 저장하세요." },
  tags_name_lower_unique: { tags: "태그를 만드는 중 충돌이 났습니다. 다시 저장하세요." },
};

/** Postgres 오류의 제약 이름. Drizzle은 드라이버 오류를 cause로 감싸므로 cause까지 확인합니다. */
function constraintOf(error: unknown): string | null {
  for (let current = error, depth = 0; current && depth < 3; depth++) {
    if (typeof current !== "object") break;
    const { constraint, code } = current as { constraint?: unknown; code?: unknown };
    // 23505 unique_violation, 23503 foreign_key_violation
    if ((code === "23505" || code === "23503") && typeof constraint === "string") return constraint;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

async function findExisting(tx: Transaction, id: number): Promise<ExistingPost | null> {
  // 같은 글을 동시에 저장하면 뒤의 요청이 앞의 트랜잭션이 끝날 때까지 기다리게 행을 잠급니다.
  const [row] = await tx
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      summary: posts.summary,
      content: posts.content,
      contentHtml: posts.contentHtml,
      status: posts.status,
      publishedAt: posts.publishedAt,
      seriesId: posts.seriesId,
      seriesOrder: posts.seriesOrder,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.id, id))
    .for("update");
  return row ?? null;
}

/** DB를 봐야 아는 규칙. 모두 검사해 한 번에 알립니다. */
async function checkConflicts(tx: Transaction, input: PostInput, id: number | null) {
  const errors: FieldErrors = {};
  const notSelf = id === null ? undefined : ne(posts.id, id);

  const [slugOwner] = await tx
    .select({ title: posts.title })
    .from(posts)
    .where(and(eq(posts.slug, input.slug), notSelf))
    .limit(1);
  if (slugOwner) {
    errors.slug = `이미 다른 글("${slugOwner.title}")이 쓰는 주소입니다.`;
  } else {
    // 다른 글의 이전 주소를 가져가면 그 글로 가던 옛 링크가 새 글로 가게 되므로 막습니다 (ADR-0012).
    const [redirect] = await tx
      .select({ title: posts.title })
      .from(postSlugRedirects)
      .innerJoin(posts, eq(posts.id, postSlugRedirects.postId))
      .where(
        and(
          eq(postSlugRedirects.oldSlug, input.slug),
          id === null ? undefined : ne(postSlugRedirects.postId, id),
        ),
      )
      .limit(1);
    if (redirect) {
      errors.slug = `다른 글("${redirect.title}")의 이전 주소라 쓸 수 없습니다. 그 주소로 들어오는 방문자를 그 글로 보내고 있습니다.`;
    }
  }

  if (input.series) {
    const [found] = await tx
      .select({ id: series.id })
      .from(series)
      .where(eq(series.id, input.series.id));
    if (!found) {
      errors.seriesId = "시리즈를 찾을 수 없습니다. 목록을 새로 고친 뒤 다시 고르세요.";
    } else {
      const [taken] = await tx
        .select({ title: posts.title })
        .from(posts)
        .where(
          and(
            eq(posts.seriesId, input.series.id),
            eq(posts.seriesOrder, input.series.order),
            notSelf,
          ),
        )
        .limit(1);
      if (taken) {
        errors.seriesOrder = `${input.series.order}번은 이미 "${taken.title}" 글이 쓰고 있습니다.`;
      }
    }
  }

  if (Object.keys(errors).length > 0) throw new FieldValidationError(errors);
}

/** 태그 이름 → id. 대소문자만 다른 기존 태그는 그 태그를 쓰고, 없으면 새로 만듭니다 (DB도 tags_name_lower_unique로 막음). */
async function resolveTagIds(tx: Transaction, names: string[]) {
  if (names.length === 0) return [];

  const existing = await tx.select({ id: tags.id, slug: tags.slug, name: tags.name }).from(tags);
  const byName = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag.id]));
  const usedSlugs = new Set(existing.map((tag) => tag.slug));

  const ids: number[] = [];
  for (const name of names) {
    const found = byName.get(name.toLowerCase());
    if (found !== undefined) {
      ids.push(found);
      continue;
    }
    const base = tagSlugFromName(name);
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    const [created] = await tx.insert(tags).values({ name, slug }).returning({ id: tags.id });
    usedSlugs.add(slug);
    byName.set(name.toLowerCase(), created.id);
    ids.push(created.id);
  }
  return ids;
}

function sameTime(a: Date | null, b: Date | null) {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

function sameIds(a: number[], b: number[]) {
  const sorted = (list: number[]) => [...list].sort((x, y) => x - y).join(",");
  return sorted(a) === sorted(b);
}

/**
 * 글 생성(id = null) 또는 수정. 바뀐 것이 없으면 아무것도 쓰지 않습니다.
 * 수정은 화면이 불러온 updated_at(baseUpdatedAt)이 잠근 행의 값과 같을 때만 씁니다. 다르면 다른 탭이나 자동 저장이
 * 먼저 저장한 것이므로 덮어쓰지 않고 conflict를 돌려줍니다(낙관적 동시성 제어, ADR-0014).
 * updated_at은 글 행의 값뿐 아니라 태그·시리즈 연결이 바뀔 때도 갱신합니다 (sitemap·RSS·JSON-LD의 수정 시각).
 */
export async function savePost({
  id,
  input,
  content,
  baseUpdatedAt,
  now = new Date(),
}: {
  id: number | null;
  input: PostInput;
  content: PostContent;
  /** 수정할 때 화면이 마지막으로 받은 updated_at. 새 글이면 null */
  baseUpdatedAt: Date | null;
  now?: Date;
}): Promise<SavePostResult> {
  await requireAdmin();

  try {
    return await withTransaction(async (tx): Promise<SavePostResult> => {
      const existing = id === null ? null : await findExisting(tx, id);
      if (id !== null && !existing) return { ok: false, notFound: true };
      // 행을 잠근 뒤 비교하므로, 두 탭이 같은 updated_at으로 동시에 저장해도 뒤의 요청은 앞의 저장 결과와 비교됩니다.
      if (existing && existing.updatedAt.getTime() !== baseUpdatedAt?.getTime()) {
        return { ok: false, conflict: true };
      }

      await checkConflicts(tx, input, id);

      // 지난 예약 시각은 저장된(잠근 행의) 예약 시각을 바꾸지 않은 경우에만 허용합니다.
      const savedScheduledAt = existing?.status === "scheduled" ? existing.publishedAt : null;
      if (
        input.publishMode === "schedule" &&
        input.scheduledAt &&
        input.scheduledAt <= now &&
        !sameTime(input.scheduledAt, savedScheduledAt)
      ) {
        throw new FieldValidationError({ scheduledAt: PAST_SCHEDULE_ERROR });
      }

      const { status, publishedAt } = resolvePublication(
        input.publishMode,
        input.scheduledAt,
        existing,
        now,
      );
      const affectsPublic = !((existing?.status ?? "draft") === "draft" && status === "draft");
      const contentHtml = content ? content.html : (existing?.contentHtml ?? "");
      // 새 본문은 문서로 판단하고(빈 목록·인용만 있는 문서도 비었다고 봄), 기존 본문을 유지하면 저장된 HTML로 판단합니다.
      const bodyEmpty = content ? content.empty : !contentHtml.trim();
      if (status !== "draft" && bodyEmpty) {
        throw new FieldValidationError({ content: "발행하거나 예약하려면 본문을 입력하세요." });
      }
      // 대체 텍스트가 없는 이미지는 화면 낭독기 사용자에게 내용이 전달되지 않으므로 공개 전에 막습니다(초안은 허용).
      if (status !== "draft" && content && content.missingAlt > 0) {
        throw new FieldValidationError({
          content: `대체 텍스트가 없는 이미지가 ${content.missingAlt}개 있습니다. 발행하거나 예약하려면 모든 이미지에 대체 텍스트를 입력하세요.`,
        });
      }

      const tagIds = await resolveTagIds(tx, input.tags);
      const values = {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        status,
        publishedAt,
        seriesId: input.series?.id ?? null,
        seriesOrder: input.series?.order ?? null,
        ...(content && { content: content.json, contentHtml: content.html }),
      };

      if (!existing) {
        const [created] = await tx
          .insert(posts)
          .values({ ...values, contentHtml })
          .returning({ id: posts.id, updatedAt: posts.updatedAt });
        if (tagIds.length > 0) {
          await tx.insert(postTags).values(tagIds.map((tagId) => ({ postId: created.id, tagId })));
        }
        return {
          ok: true,
          id: created.id,
          slug: input.slug,
          changed: true,
          updatedAt: created.updatedAt,
          affectsPublic,
        };
      }

      const currentTagIds = (
        await tx.select({ tagId: postTags.tagId }).from(postTags).where(eq(postTags.postId, id!))
      ).map((row) => row.tagId);
      const tagsChanged = !sameIds(currentTagIds, tagIds);
      const contentChanged =
        content !== null &&
        (content.html !== existing.contentHtml ||
          stableStringify(content.json) !== stableStringify(existing.content));
      const changed =
        tagsChanged ||
        contentChanged ||
        existing.slug !== values.slug ||
        existing.title !== values.title ||
        existing.summary !== values.summary ||
        existing.status !== values.status ||
        !sameTime(existing.publishedAt, values.publishedAt) ||
        existing.seriesId !== values.seriesId ||
        existing.seriesOrder !== values.seriesOrder;
      if (!changed) {
        return {
          ok: true,
          id: existing.id,
          slug: existing.slug,
          changed: false,
          updatedAt: existing.updatedAt,
          affectsPublic: false,
        };
      }

      // 태그만 바뀌어도 글의 수정 시각을 갱신합니다. 스키마의 $onUpdate에 기대지 않고 명시합니다.
      await tx
        .update(posts)
        .set({ ...values, updatedAt: now })
        .where(eq(posts.id, existing.id));

      if (tagsChanged) {
        await tx.delete(postTags).where(eq(postTags.postId, existing.id));
        if (tagIds.length > 0) {
          await tx.insert(postTags).values(tagIds.map((tagId) => ({ postId: existing.id, tagId })));
        }
      }

      if (existing.slug !== input.slug) {
        // 이전 주소는 상태와 상관없이 항상 이 글 몫으로 남깁니다 (ADR-0012). 지금 초안이어도 예전에 공개된 적이 있으면
        // 바깥 링크가 남아 있을 수 있고, 다른 글이 그 주소를 가져가면 옛 링크가 엉뚱한 글로 가기 때문입니다.
        // 이동할 글이 공개 상태가 아니면 공개 페이지는 그대로 404입니다(getRedirectedSlug).
        await tx
          .insert(postSlugRedirects)
          .values({ oldSlug: existing.slug, postId: existing.id })
          .onConflictDoUpdate({
            target: postSlugRedirects.oldSlug,
            set: { postId: existing.id, createdAt: now },
          });
        // 예전 주소로 되돌린 경우: 그 주소는 다시 글이 직접 쓰므로 리다이렉트를 지웁니다.
        await tx.delete(postSlugRedirects).where(eq(postSlugRedirects.oldSlug, input.slug));
      }

      return {
        ok: true,
        id: existing.id,
        slug: input.slug,
        changed: true,
        updatedAt: now,
        affectsPublic,
      };
    });
  } catch (error) {
    if (error instanceof FieldValidationError) return { ok: false, errors: error.errors };
    const constraint = constraintOf(error);
    if (constraint && CONSTRAINT_ERRORS[constraint]) {
      return { ok: false, errors: CONSTRAINT_ERRORS[constraint] };
    }
    throw error;
  }
}

/**
 * 글 삭제. 태그 연결(post_tags)과 이전 주소(post_slug_redirects)는 외래 키의 ON DELETE cascade로 함께 지워집니다.
 * 시리즈는 글 쪽이 참조하므로(series_id) 글을 지워도 시리즈는 남고, 그 순번은 비게 됩니다.
 * 지운 글이 없으면 null을 반환합니다.
 */
export async function deletePostById(id: number) {
  await requireAdmin();

  const [deleted] = await getDb()
    .delete(posts)
    .where(eq(posts.id, id))
    .returning({ id: posts.id, slug: posts.slug });
  return deleted ?? null;
}
