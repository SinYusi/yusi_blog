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

import { getEndpointId } from "@/db/connection-urls";
import { posts, postTags, series, tags } from "@/db/schema";
import { seedPosts, seedSeries, seedTags } from "@/db/seed-data";

const vercelEnv = process.env.VERCEL_ENV;

// 운영 빌드도 vercel-build에서 --preview-only로 호출하므로, 건너뛰기 검사를 운영 거부보다 먼저 합니다.
if (process.argv.includes("--preview-only") && vercelEnv !== "preview") {
  console.log(`미리보기 환경이 아니므로 시드를 건너뜁니다 (VERCEL_ENV=${vercelEnv ?? "없음"}).`);
  process.exit(0);
}
if (vercelEnv === "production") {
  console.error("운영 환경(VERCEL_ENV=production)에서는 시드를 실행하지 않습니다.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 없습니다. .env.example을 참고해 .env.local을 만드세요.");
  process.exit(1);
}

/*
 * 쓰기 전에 대상 DB를 확인합니다. .env.local이나 미리보기 환경 변수가 실수로 운영 DB를 가리켜도
 * 운영 글을 덮어쓰지 않게 합니다. 운영 엔드포인트 ID는 공개 저장소에 두지 않고 환경 변수로 받습니다.
 * - 미리보기 빌드: PR마다 새 DB 브랜치가 생겨 허용 목록을 둘 수 없으므로, Vercel 미리보기 환경 변수
 *   SEED_BLOCKED_ENDPOINT(운영 엔드포인트)와 다른지 확인합니다. 값이 없으면 확인할 수 없으므로 중단합니다.
 * - 로컬: SEED_ALLOWED_ENDPOINT에 적은 엔드포인트(Neon dev 브랜치)일 때만 실행합니다.
 */
const endpoint = getEndpointId(url);
if (vercelEnv === "preview") {
  const blocked = process.env.SEED_BLOCKED_ENDPOINT;
  if (!blocked || endpoint === blocked) {
    console.error(
      blocked
        ? `시드 대상 ${endpoint}이(가) 운영 DB(SEED_BLOCKED_ENDPOINT)입니다.`
        : "SEED_BLOCKED_ENDPOINT가 없어 시드 대상이 운영 DB가 아닌지 확인할 수 없습니다. Vercel 미리보기 환경 변수에 운영 엔드포인트 ID를 설정하세요.",
    );
    process.exit(1);
  }
} else if (endpoint !== process.env.SEED_ALLOWED_ENDPOINT) {
  console.error(
    `시드 대상 ${endpoint}이(가) SEED_ALLOWED_ENDPOINT와 다릅니다. ` +
      "Neon dev 브랜치가 맞는지 pnpm db:check로 확인한 뒤 .env.local의 SEED_ALLOWED_ENDPOINT에 적으세요.",
  );
  process.exit(1);
}

const db = drizzle({ connection: url });
console.log(`시드 대상: ${endpoint} (${new URL(url).hostname})`);

const seriesIdBySlug = (slug: string) =>
  sql`(select ${series.id} from ${series} where ${series.slug} = ${slug})`;
const seededSlugs = seedPosts.map((post) => post.slug);

await db.batch([
  db
    .insert(series)
    .values(seedSeries.map((s) => ({ ...s })))
    .onConflictDoUpdate({
      target: series.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        // 글과 같이, 내용이 바뀐 경우에만 수정 시각을 갱신합니다 (스키마의 $onUpdate 대신).
        updatedAt: sql`case when (${series.name}, ${series.description}) is distinct from (excluded.name, excluded.description)
          then now() else ${series.updatedAt} end`,
      },
    }),
  db
    .insert(tags)
    .values(seedTags.map((t) => ({ ...t })))
    .onConflictDoUpdate({
      target: tags.slug,
      set: {
        name: sql`excluded.name`,
        updatedAt: sql`case when ${tags.name} is distinct from excluded.name then now() else ${tags.updatedAt} end`,
      },
    }),
  // 시리즈 순번 고유 제약과 부딪히지 않도록, 시드 글의 시리즈 연결을 먼저 풀고 다시 넣습니다.
  db
    .update(posts)
    // 스키마의 $onUpdate가 수정 시각을 바꾸지 않도록 현재 값을 그대로 둡니다.
    .set({ seriesId: null, seriesOrder: null, updatedAt: sql`${posts.updatedAt}` })
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
        // 글 내용이 바뀐 경우에만 수정 시각을 갱신합니다 (sitemap lastmod 등이 반복 실행으로 바뀌지 않게).
        // 시리즈 연결은 앞 단계에서 풀었다가 다시 넣으므로 비교에서 뺍니다.
        updatedAt: sql`case when (${posts.title}, ${posts.summary}, ${posts.contentHtml}, ${posts.status}, ${posts.publishedAt})
          is distinct from (excluded.title, excluded.summary, excluded.content_html, excluded.status, excluded.published_at)
          then now() else ${posts.updatedAt} end`,
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
