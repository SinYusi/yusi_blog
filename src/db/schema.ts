import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/*
 * 1단계 스키마: 글, 시리즈, 태그. 사용자·이미지는 2단계(CMS)에서 추가합니다.
 * 정수 식별자를 쓰고, URL에는 slug를 씁니다.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const postStatus = pgEnum("post_status", ["draft", "published", "scheduled"]);

export const series = pgTable("series", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  ...timestamps,
});

export const posts = pgTable(
  "posts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    /** 에디터(Tiptap) 원본 문서. 에디터가 생기는 2단계 전까지는 비어 있을 수 있습니다. */
    content: jsonb("content"),
    /** 발행 시점에 렌더링해 저장한 본문 HTML. 공개 페이지는 이 값만 읽습니다. */
    contentHtml: text("content_html").notNull().default(""),
    status: postStatus("status").notNull().default("draft"),
    /** 발행(예약) 시각. 발행·예약 상태에서는 반드시 있어야 합니다. */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // 시리즈 삭제 시 series_order만 남아 제약을 어기지 않도록, 글이 남은 시리즈는 삭제를 막습니다.
    seriesId: integer("series_id").references(() => series.id, { onDelete: "restrict" }),
    /** 시리즈 안에서의 순서 (1부터). 시리즈에 속하지 않으면 비어 있습니다. */
    seriesOrder: integer("series_order"),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    // 공개 목록: 발행된 글을 최신순으로 조회
    index("posts_status_published_at_idx").on(table.status, table.publishedAt.desc()),
    // series_id로 시작하는 인덱스를 겸하므로 series_id 단독 인덱스는 두지 않습니다.
    unique("posts_series_order_unique").on(table.seriesId, table.seriesOrder),
    check(
      "posts_published_at_required",
      sql`${table.status} = 'draft' or ${table.publishedAt} is not null`,
    ),
    check(
      "posts_series_order_consistency",
      sql`(${table.seriesId} is null) = (${table.seriesOrder} is null)`,
    ),
    check(
      "posts_series_order_positive",
      sql`${table.seriesOrder} is null or ${table.seriesOrder} > 0`,
    ),
    check("posts_counts_non_negative", sql`${table.viewCount} >= 0 and ${table.likeCount} >= 0`),
  ],
);

export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().unique(),
  ...timestamps,
});

export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    // 태그별 글 목록 조회용 (기본 키는 post_id가 앞이라 tag_id 조회에 쓰이지 않음)
    index("post_tags_tag_id_idx").on(table.tagId),
  ],
);

export const seriesRelations = relations(series, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  series: one(series, { fields: [posts.seriesId], references: [series.id] }),
  postTags: many(postTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Series = typeof series.$inferSelect;
export type Tag = typeof tags.$inferSelect;
