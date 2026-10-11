/*
 * 글 저장 입력 검증(post-input.ts) 테스트. pnpm test로 실행합니다 (node:test + tsx).
 * DB가 필요한 규칙(slug·순번 중복)은 여기서 다루지 않고, PR의 확인 방법에 있는 시나리오로 확인합니다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPubliclyVisible,
  parseKstDateTimeLocal,
  publishModeOf,
  resolvePublication,
  stableStringify,
  tagSlugFromName,
  toKstDateTimeLocal,
  validatePostInput,
  type RawPostForm,
} from "./post-input";

const NOW = new Date("2026-10-02T03:00:00Z"); // 한국 시간 2026-10-02 12:00

function raw(overrides: Partial<RawPostForm> = {}): RawPostForm {
  return {
    title: "글 제목",
    slug: "my-post",
    summary: "",
    tags: [],
    seriesId: "",
    seriesOrder: "",
    publishMode: "draft",
    scheduledAt: null,
    ...overrides,
  };
}

function errorsOf(overrides: Partial<RawPostForm>) {
  const result = validatePostInput(raw(overrides), NOW);
  return result.ok ? {} : result.errors;
}

describe("validatePostInput", () => {
  it("올바른 초안을 통과시키고 앞뒤 공백을 지운다", () => {
    const result = validatePostInput(raw({ title: "  제목  ", summary: " 요약 " }), NOW);
    assert.ok(result.ok);
    assert.equal(result.value.title, "제목");
    assert.equal(result.value.summary, "요약");
    assert.equal(result.value.series, null);
    assert.equal(result.value.scheduledAt, null);
  });

  it("제목이 비었거나 길면 거부한다", () => {
    assert.ok(errorsOf({ title: "   " }).title);
    // 브라우저 maxLength와 같은 UTF-16 기준: 이모지 100개 = 200자는 통과, 101개는 초과
    assert.equal(errorsOf({ title: "😀".repeat(100) }).title, undefined);
    assert.ok(errorsOf({ title: "😀".repeat(101) }).title);
    assert.ok(errorsOf({ title: "가".repeat(201) }).title);
    assert.equal(errorsOf({ title: "가".repeat(200) }).title, undefined);
  });

  it("slug 형식: 영문 소문자·숫자·하이픈만", () => {
    for (const slug of ["a", "my-post-2", "2026-review"]) {
      assert.equal(errorsOf({ slug }).slug, undefined, slug);
    }
    for (const slug of [
      "",
      "My-Post",
      "한글-주소",
      "-start",
      "end-",
      "double--hyphen",
      "with space",
      "a_b",
    ]) {
      assert.ok(errorsOf({ slug }).slug, slug);
    }
    assert.ok(errorsOf({ slug: "a".repeat(81) }).slug);
  });

  it("다른 라우트와 겹치는 slug는 거부한다", () => {
    assert.ok(errorsOf({ slug: "page" }).slug);
  });

  it("FormData의 파일 같은 문자열이 아닌 값은 빈 값으로 본다", () => {
    assert.ok(errorsOf({ title: new Blob(["x"]) }).title);
  });

  it("태그: 정리하고 대소문자만 다른 중복을 합치며 개수·길이를 제한한다", () => {
    const result = validatePostInput(
      raw({ tags: ["  #Next.js ", "next.js", "", "코드  리뷰"] }),
      NOW,
    );
    assert.ok(result.ok);
    assert.deepEqual(result.value.tags, ["Next.js", "코드 리뷰"]);
    const split = validatePostInput(raw({ tags: ["React, 성능, 리팩토링", "react,"] }), NOW);
    assert.ok(split.ok);
    assert.deepEqual(split.value.tags, ["React", "성능", "리팩토링"]);

    assert.ok(errorsOf({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).tags);
    assert.equal(errorsOf({ tags: Array.from({ length: 10 }, (_, i) => `t${i}`) }).tags, undefined);
    assert.ok(errorsOf({ tags: ["가".repeat(31)] }).tags);
  });

  it("시리즈: 고르면 순번이 필요하고 1 이상 정수여야 한다", () => {
    const ok = validatePostInput(raw({ seriesId: "3", seriesOrder: "2" }), NOW);
    assert.ok(ok.ok);
    assert.deepEqual(ok.value.series, { id: 3, order: 2 });

    assert.ok(errorsOf({ seriesId: "3", seriesOrder: "" }).seriesOrder);
    for (const order of ["0", "-1", "1.5", "abc", "10000"]) {
      assert.ok(errorsOf({ seriesId: "3", seriesOrder: order }).seriesOrder, order);
    }
    assert.ok(errorsOf({ seriesId: "x", seriesOrder: "1" }).seriesId);
  });

  it("시리즈를 고르지 않으면 순번은 무시한다 (series_id·series_order는 함께 비어 있어야 함)", () => {
    const result = validatePostInput(raw({ seriesId: "", seriesOrder: "5" }), NOW);
    assert.ok(result.ok);
    assert.equal(result.value.series, null);
  });

  it("발행 설정 값은 정해진 것만 받는다", () => {
    assert.ok(errorsOf({ publishMode: "published" }).publishMode);
    assert.ok(errorsOf({ publishMode: null }).publishMode);
  });

  it("예약: 한국 시간으로 읽고, 지금보다 뒤여야 한다", () => {
    const result = validatePostInput(
      raw({ publishMode: "schedule", scheduledAt: "2026-10-02T12:01" }),
      NOW,
    );
    assert.ok(result.ok);
    assert.equal(result.value.scheduledAt?.toISOString(), "2026-10-02T03:01:00.000Z");

    assert.ok(errorsOf({ publishMode: "schedule", scheduledAt: "2026-10-02T12:00" }).scheduledAt);
    // 저장된 예약 시각을 바꾸지 않았다면 그 시각이 지났어도 다른 수정은 저장됩니다.
    const saved = new Date("2026-10-02T02:00:00Z"); // 한국 시간 11:00, NOW보다 과거
    const keep = raw({ publishMode: "schedule", scheduledAt: "2026-10-02T11:00" });
    assert.ok(validatePostInput(keep, NOW, saved).ok);
    const changed = raw({ publishMode: "schedule", scheduledAt: "2026-10-02T11:30" });
    assert.equal(validatePostInput(changed, NOW, saved).ok, false);
    // 서버는 잠근 행과 비교하려고 이 검사를 savePost로 미룹니다.
    assert.ok(validatePostInput(changed, NOW, "defer").ok);
    assert.ok(errorsOf({ publishMode: "schedule", scheduledAt: "" }).scheduledAt);
    assert.ok(errorsOf({ publishMode: "schedule", scheduledAt: "내일" }).scheduledAt);
  });

  it("예약이 아니면 발행 시각 입력은 무시한다", () => {
    const result = validatePostInput(raw({ publishMode: "publish", scheduledAt: "x" }), NOW);
    assert.ok(result.ok);
    assert.equal(result.value.scheduledAt, null);
  });
});

describe("한국 시간 변환", () => {
  it("datetime-local 값을 UTC+9로 읽고 되돌린다", () => {
    const date = parseKstDateTimeLocal("2026-01-01T00:30");
    assert.equal(date?.toISOString(), "2025-12-31T15:30:00.000Z");
    assert.equal(toKstDateTimeLocal(date!), "2026-01-01T00:30");
  });

  it("초가 붙은 값도 분 단위로 읽는다", () => {
    assert.equal(
      parseKstDateTimeLocal("2026-10-02T12:01:00")?.toISOString(),
      "2026-10-02T03:01:00.000Z",
    );
  });

  it("없는 날짜·시각은 거부한다", () => {
    for (const value of [
      "2026-02-30T10:00",
      "2026-13-01T10:00",
      "2026-10-02T24:00",
      "2026-10-02 10:00",
    ]) {
      assert.equal(parseKstDateTimeLocal(value), null, value);
    }
  });
});

describe("resolvePublication (DB 제약 posts_published_at_required)", () => {
  const past = new Date("2026-09-01T00:00:00Z");
  const future = new Date("2026-10-05T00:00:00Z");

  it("초안은 발행 시각을 지운다", () => {
    assert.deepEqual(resolvePublication("draft", null, null, NOW), {
      status: "draft",
      publishedAt: null,
    });
  });

  it("처음 발행하면 지금이 발행 시각이다", () => {
    assert.deepEqual(resolvePublication("publish", null, null, NOW), {
      status: "published",
      publishedAt: NOW,
    });
    assert.deepEqual(
      resolvePublication("publish", null, { status: "draft", publishedAt: null }, NOW),
      { status: "published", publishedAt: NOW },
    );
  });

  it("이미 공개된 글은 처음 발행 시각을 유지한다", () => {
    assert.deepEqual(
      resolvePublication("publish", null, { status: "published", publishedAt: past }, NOW),
      { status: "published", publishedAt: past },
    );
    // 시각이 지나 공개된 예약 글도 같은 규칙
    assert.deepEqual(
      resolvePublication("publish", null, { status: "scheduled", publishedAt: past }, NOW),
      { status: "published", publishedAt: past },
    );
  });

  it("아직 공개되지 않은 예약 글을 지금 발행하면 지금이 발행 시각이다", () => {
    assert.deepEqual(
      resolvePublication("publish", null, { status: "scheduled", publishedAt: future }, NOW),
      { status: "published", publishedAt: NOW },
    );
  });

  it("예약은 입력한 시각을 쓴다", () => {
    assert.deepEqual(resolvePublication("schedule", future, null, NOW), {
      status: "scheduled",
      publishedAt: future,
    });
    assert.throws(() => resolvePublication("schedule", null, null, NOW));
  });

  it("초안이 아니면 항상 발행 시각이 있다", () => {
    for (const mode of ["publish", "schedule"] as const) {
      const result = resolvePublication(mode, future, null, NOW);
      assert.notEqual(result.publishedAt, null);
    }
  });
});

describe("공개 상태", () => {
  it("공개 조건은 lib/content/posts.ts의 isPublic과 같다", () => {
    const past = new Date("2026-09-01T00:00:00Z");
    const future = new Date("2026-10-05T00:00:00Z");
    assert.equal(isPubliclyVisible({ status: "published", publishedAt: past }, NOW), true);
    assert.equal(isPubliclyVisible({ status: "scheduled", publishedAt: past }, NOW), true);
    assert.equal(isPubliclyVisible({ status: "scheduled", publishedAt: future }, NOW), false);
    assert.equal(isPubliclyVisible({ status: "published", publishedAt: future }, NOW), false);
    assert.equal(isPubliclyVisible({ status: "draft", publishedAt: past }, NOW), false);
  });

  it("저장된 글 → 화면의 발행 설정", () => {
    const future = new Date("2026-10-05T00:00:00Z");
    assert.equal(publishModeOf({ status: "draft", publishedAt: null }, NOW), "draft");
    assert.equal(publishModeOf({ status: "scheduled", publishedAt: future }, NOW), "schedule");
    assert.equal(publishModeOf({ status: "published", publishedAt: NOW }, NOW), "publish");
  });
});

describe("tagSlugFromName", () => {
  it("영문은 소문자로, 한글은 그대로, 문장 부호는 지운다", () => {
    assert.equal(tagSlugFromName("Next.js"), "nextjs");
    assert.equal(tagSlugFromName("GitHub Actions"), "github-actions");
    assert.equal(tagSlugFromName("코드 리뷰"), "코드-리뷰");
    assert.equal(tagSlugFromName("#C++"), "c");
    assert.equal(tagSlugFromName("!!!"), "tag");
  });
});

describe("stableStringify", () => {
  it("키 순서가 달라도 같은 문자열을 만든다", () => {
    assert.equal(
      stableStringify({ type: "doc", content: [{ b: 1, a: null }] }),
      stableStringify({ content: [{ a: null, b: 1 }], type: "doc" }),
    );
    assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
  });
});
