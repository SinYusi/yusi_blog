/**
 * 시드 데이터를 DB에 넣습니다. slug 기준으로 있으면 갱신하고 없으면 추가하므로 여러 번 실행해도 결과가 같습니다.
 * 모든 쓰기는 하나의 트랜잭션(batch)으로 실행되어, 실패하면 아무것도 바뀌지 않습니다.
 *
 * 실행
 * - 로컬: pnpm db:seed (.env.local의 dev 브랜치)
 * - Vercel 미리보기 빌드: tsx scripts/seed.mts --preview-only (미리보기 환경에서만 실행, 그 외에는 건너뜀)
 */
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { posts, postTags, series, tags } from "@/db/schema";
import { seedPosts, seedSeries, seedTags } from "@/db/seed-data";

const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv === "production") {
  console.error("운영 환경(VERCEL_ENV=production)에서는 시드를 실행하지 않습니다.");
  process.exit(1);
}
if (process.argv.includes("--preview-only") && vercelEnv !== "preview") {
  console.log(`미리보기 환경이 아니므로 시드를 건너뜁니다 (VERCEL_ENV=${vercelEnv ?? "없음"}).`);
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 없습니다. .env.example을 참고해 .env.local을 만드세요.");
  process.exit(1);
}

const db = drizzle({ connection: url });
console.log(`시드 대상: ${new URL(url).hostname}`);

const seriesIdBySlug = (slug: string) =>
  sql`(select ${series.id} from ${series} where ${series.slug} = ${slug})`;
const seededSlugs = seedPosts.map((post) => post.slug);

await db.batch([
  db
    .insert(series)
    .values(seedSeries.map((s) => ({ ...s })))
    .onConflictDoUpdate({
      target: series.slug,
      set: { name: sql`excluded.name`, description: sql`excluded.description` },
    }),
  db
    .insert(tags)
    .values(seedTags.map((t) => ({ ...t })))
    .onConflictDoUpdate({ target: tags.slug, set: { name: sql`excluded.name` } }),
  // 시리즈 순번 고유 제약과 부딪히지 않도록, 시드 글의 시리즈 연결을 먼저 풀고 다시 넣습니다.
  db
    .update(posts)
    .set({ seriesId: null, seriesOrder: null })
    .where(inArray(posts.slug, seededSlugs)),
  db
    .insert(posts)
    .values(
      seedPosts.map((post) => ({
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        contentHtml: post.contentHtml,
        status: post.status,
        publishedAt: post.publishedAt,
        seriesId: post.series ? seriesIdBySlug(post.series.slug) : null,
        seriesOrder: post.series?.order ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: posts.slug,
      set: {
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        contentHtml: sql`excluded.content_html`,
        status: sql`excluded.status`,
        publishedAt: sql`excluded.published_at`,
        seriesId: sql`excluded.series_id`,
        seriesOrder: sql`excluded.series_order`,
        updatedAt: sql`now()`,
      },
    }),
  db
    .delete(postTags)
    .where(
      inArray(
        postTags.postId,
        db.select({ id: posts.id }).from(posts).where(inArray(posts.slug, seededSlugs)),
      ),
    ),
  db.insert(postTags).select(
    sql`select p.id, t.id from ${posts} p join (values ${sql.join(
      seedPosts.flatMap((post) => post.tags.map((tag) => sql`(${post.slug}, ${tag})`)),
      sql`, `,
    )}) as v(post_slug, tag_slug) on p.slug = v.post_slug join ${tags} t on t.slug = v.tag_slug`,
  ),
]);

const [counts] = await db
  .execute<{ posts: number; published: number; series: number; tags: number; links: number }>(
    sql`select
    (select count(*)::int from ${posts}) as posts,
    (select count(*)::int from ${posts} where ${posts.status} = 'published') as published,
    (select count(*)::int from ${series}) as series,
    (select count(*)::int from ${tags}) as tags,
    (select count(*)::int from ${postTags}) as links`,
  )
  .then((result) => result.rows);

console.log(
  `시드 완료: 글 ${counts.posts}개 (발행 ${counts.published}), 시리즈 ${counts.series}개, 태그 ${counts.tags}개, 태그 연결 ${counts.links}개`,
);
