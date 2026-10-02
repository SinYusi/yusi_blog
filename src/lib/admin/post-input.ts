/*
 * 관리자 글 저장 입력의 검증 규칙. DB에 닿지 않는 순수 함수만 두어 서버 액션과 테스트(post-input.test.ts)가 함께 씁니다.
 * 화면(클라이언트)의 required·pattern 등은 편의일 뿐이고, 서버 액션이 항상 이 함수로 다시 검사합니다.
 * DB를 봐야 하는 검사(slug 중복, 시리즈 존재·순번 중복)는 lib/admin/post-mutations.ts가 트랜잭션 안에서 합니다.
 */

export const TITLE_MAX = 200;
export const SUMMARY_MAX = 300;
export const SLUG_MAX = 80;
export const TAG_NAME_MAX = 30;
export const TAGS_MAX = 10;
export const SERIES_ORDER_MAX = 9999;

/**
 * 글 slug 형식: 영문 소문자·숫자를 하이픈 하나로 이은 형태 (ADR-0012).
 * 한글을 허용하지 않는 이유: 공유·sitemap·RSS에서 퍼센트 인코딩된 긴 주소가 되고, 정규화(NFC/NFD) 차이로 같은 글자가 다른 주소가 될 수 있습니다.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** HTML pattern 속성용 (브라우저 검사. 서버가 SLUG_PATTERN으로 다시 검사합니다) */
export const SLUG_PATTERN_HTML = "[a-z0-9]+(-[a-z0-9]+)*";

/** 다른 라우트와 겹치는 slug. /posts/page는 목록 페이지네이션(/posts/page/[page])이 쓰는 경로입니다. */
export const RESERVED_SLUGS: readonly string[] = ["page"];

export const PUBLISH_MODES = ["draft", "publish", "schedule"] as const;
/** 화면의 발행 설정: 초안 / 발행(지금 공개) / 예약(발행 시각에 공개) */
export type PublishMode = (typeof PUBLISH_MODES)[number];

export type PostStatus = "draft" | "published" | "scheduled";

export type PostField =
  | "title"
  | "slug"
  | "summary"
  | "tags"
  | "seriesId"
  | "seriesOrder"
  | "publishMode"
  | "scheduledAt"
  | "content";

export type FieldErrors = Partial<Record<PostField, string>>;

/** FormData에서 꺼낸 값. 아직 아무것도 믿지 않은 상태입니다. */
export type RawPostForm = {
  title: unknown;
  slug: unknown;
  summary: unknown;
  tags: unknown[];
  seriesId: unknown;
  seriesOrder: unknown;
  publishMode: unknown;
  scheduledAt: unknown;
};

export type PostInput = {
  title: string;
  slug: string;
  summary: string;
  /** 정리한 태그 이름 (대소문자만 다른 중복은 처음 것만 남김) */
  tags: string[];
  series: { id: number; order: number } | null;
  publishMode: PublishMode;
  /** 예약일 때만 값이 있습니다. */
  scheduledAt: Date | null;
};

export type ValidationResult = { ok: true; value: PostInput } | { ok: false; errors: FieldErrors };

export function readPostForm(formData: FormData): RawPostForm {
  return {
    title: formData.get("title"),
    slug: formData.get("slug"),
    summary: formData.get("summary"),
    tags: formData.getAll("tags"),
    seriesId: formData.get("seriesId"),
    seriesOrder: formData.get("seriesOrder"),
    publishMode: formData.get("publishMode"),
    scheduledAt: formData.get("scheduledAt"),
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** 글자 수는 코드 포인트 기준으로 셉니다 (이모지 하나를 두 글자로 세지 않음). */
function length(value: string) {
  return Array.from(value).length;
}

/** 태그 이름 정리: 앞뒤 공백과 앞의 #을 지우고, 연속 공백을 하나로 줄입니다. */
export function normalizeTagName(value: string) {
  return value.normalize("NFC").trim().replace(/^#+/, "").trim().replace(/\s+/g, " ");
}

// tsconfig target(ES2017)에서는 정규식 리터럴의 u 플래그를 쓸 수 없어 생성자로 만듭니다.
const NON_TAG_SLUG_CHARS = new RegExp("[^\\p{L}\\p{M}\\p{N}\\s_-]", "gu");

/**
 * 새 태그의 slug. 태그는 이름만 입력받으므로 이름으로 만듭니다 (ADR-0012).
 * 한글 이름은 로마자로 바꿀 수 없어 글자를 그대로 둡니다(소제목 id와 같은 규칙). 예: "Next.js" → "nextjs", "코드 리뷰" → "코드-리뷰"
 * 다른 태그와 겹치면 저장할 때 -2, -3을 붙입니다.
 */
export function tagSlugFromName(name: string) {
  const slug = normalizeTagName(name)
    .toLowerCase()
    .replace(NON_TAG_SLUG_CHARS, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tag";
}

// 브라우저에 따라 초가 붙어 올 수 있어(step을 바꾸면 HH:mm:ss) 초는 있어도 받고, 저장은 분 단위로 합니다.
const DATE_TIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * datetime-local 입력값(YYYY-MM-DDTHH:mm)을 한국 시간으로 읽습니다. 한국은 일광 절약 시간이 없어 항상 UTC+9입니다.
 * 형식이 틀리거나 없는 날짜(2월 30일, 25시 등)면 null입니다.
 */
export function parseKstDateTimeLocal(value: string): Date | null {
  const match = DATE_TIME_LOCAL.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS);
  // Date.UTC는 범위를 넘는 값(13월, 31일이 없는 달의 31일)을 다음 달로 넘기므로, 되돌려 같은 값인지 확인합니다.
  return toKstDateTimeLocal(date) === match[0].slice(0, 16) ? date : null;
}

/** Date → datetime-local 입력값(한국 시간, 분 단위) */
export function toKstDateTimeLocal(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

function parsePositiveInt(value: string, max: number) {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= max ? number : null;
}

/** 저장 전 형식 검사. 시각 비교는 인자로 받은 now를 기준으로 합니다(테스트에서 고정). */
export function validatePostInput(raw: RawPostForm, now: Date): ValidationResult {
  const errors: FieldErrors = {};

  const title = text(raw.title).trim();
  if (!title) errors.title = "제목을 입력하세요.";
  else if (length(title) > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자 이하로 입력하세요.`;

  const slug = text(raw.slug).trim();
  if (!slug) errors.slug = "주소(slug)를 입력하세요.";
  else if (slug.length > SLUG_MAX) errors.slug = `주소는 ${SLUG_MAX}자 이하로 입력하세요.`;
  else if (!SLUG_PATTERN.test(slug)) {
    errors.slug =
      "영문 소문자, 숫자, 하이픈(-)만 쓸 수 있고 하이픈으로 시작·끝나거나 연달아 쓸 수 없습니다.";
  } else if (RESERVED_SLUGS.includes(slug)) {
    errors.slug = `"${slug}"는 다른 페이지가 쓰는 주소라 쓸 수 없습니다.`;
  }

  const summary = text(raw.summary).trim();
  if (length(summary) > SUMMARY_MAX) errors.summary = `요약은 ${SUMMARY_MAX}자 이하로 입력하세요.`;

  const tags: string[] = [];
  const seenTags = new Set<string>();
  for (const value of raw.tags) {
    const name = normalizeTagName(text(value));
    if (!name) continue;
    if (length(name) > TAG_NAME_MAX) {
      errors.tags = `태그 이름은 ${TAG_NAME_MAX}자 이하로 입력하세요: ${name}`;
      break;
    }
    const key = name.toLowerCase();
    if (seenTags.has(key)) continue;
    seenTags.add(key);
    tags.push(name);
  }
  if (!errors.tags && tags.length > TAGS_MAX) {
    errors.tags = `태그는 ${TAGS_MAX}개까지 붙일 수 있습니다.`;
  }

  let series: PostInput["series"] = null;
  const seriesIdText = text(raw.seriesId).trim();
  if (seriesIdText) {
    const seriesId = parsePositiveInt(seriesIdText, 2_147_483_647);
    const orderText = text(raw.seriesOrder).trim();
    const order = parsePositiveInt(orderText, SERIES_ORDER_MAX);
    if (seriesId === null) errors.seriesId = "시리즈를 다시 선택하세요.";
    if (!orderText) errors.seriesOrder = "시리즈 안에서의 순번을 입력하세요.";
    else if (order === null) {
      errors.seriesOrder = `순번은 1부터 ${SERIES_ORDER_MAX} 사이의 정수로 입력하세요.`;
    }
    if (seriesId !== null && order !== null) series = { id: seriesId, order };
  }
  // 시리즈를 고르지 않으면 순번은 무시합니다 (DB 제약: 둘은 함께 있거나 함께 비어 있어야 함).

  const publishMode = (PUBLISH_MODES as readonly unknown[]).includes(raw.publishMode)
    ? (raw.publishMode as PublishMode)
    : null;
  if (!publishMode) errors.publishMode = "발행 설정을 고르세요.";

  let scheduledAt: Date | null = null;
  if (publishMode === "schedule") {
    const value = text(raw.scheduledAt).trim();
    scheduledAt = value ? parseKstDateTimeLocal(value) : null;
    if (!value) errors.scheduledAt = "발행 시각을 입력하세요.";
    else if (!scheduledAt) errors.scheduledAt = "발행 시각 형식이 올바르지 않습니다.";
    else if (scheduledAt <= now) {
      errors.scheduledAt =
        "예약 발행 시각은 지금보다 뒤여야 합니다. 바로 공개하려면 '발행'을 고르세요.";
    }
  }

  if (Object.keys(errors).length > 0 || !publishMode) return { ok: false, errors };
  return {
    ok: true,
    value: { title, slug, summary, tags, series, publishMode, scheduledAt },
  };
}

/** 공개 페이지와 같은 기준(lib/content/posts.ts의 isPublic): 초안이 아니고 발행 시각이 지난 글 */
export function isPubliclyVisible(
  post: { status: PostStatus; publishedAt: Date | null },
  now: Date,
) {
  return post.status !== "draft" && post.publishedAt !== null && post.publishedAt <= now;
}

/**
 * 발행 설정 → DB의 status, published_at. DB 제약(posts_published_at_required: 초안이 아니면 발행 시각 필수)을 항상 지킵니다.
 * - 초안: 발행 시각을 지웁니다. 다시 발행하면 그때가 발행 시각이 됩니다.
 * - 발행: 이미 공개된 글은 처음 발행 시각을 유지하고(수정해도 발행일이 바뀌지 않음), 아니면 지금 공개합니다.
 * - 예약: 입력한 시각. 시각이 지나면 공개 조건(isPublic)에 따라 별도 작업 없이 공개됩니다.
 */
export function resolvePublication(
  mode: PublishMode,
  scheduledAt: Date | null,
  existing: { status: PostStatus; publishedAt: Date | null } | null,
  now: Date,
): { status: PostStatus; publishedAt: Date | null } {
  if (mode === "draft") return { status: "draft", publishedAt: null };
  if (mode === "schedule") {
    if (!scheduledAt) throw new Error("예약 발행에는 발행 시각이 필요합니다.");
    return { status: "scheduled", publishedAt: scheduledAt };
  }
  const keep = existing && isPubliclyVisible(existing, now) ? existing.publishedAt : null;
  return { status: "published", publishedAt: keep ?? now };
}

/** 저장된 글 → 화면의 발행 설정 초기값 */
export function publishModeOf(post: { status: PostStatus; publishedAt: Date | null }, now: Date) {
  if (post.status === "draft") return "draft";
  return isPubliclyVisible(post, now) ? "publish" : "schedule";
}

/** 객체 키 순서와 상관없이 같은 JSON 값이면 같은 문자열을 만듭니다 (jsonb는 키 순서를 보존하지 않음). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
