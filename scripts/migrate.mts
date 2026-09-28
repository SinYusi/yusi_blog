/**
 * 마이그레이션을 DB 잠금으로 직렬화해 적용합니다.
 *
 * 같은 DB 브랜치를 대상으로 빌드가 동시에 실행되면(예: PR에 커밋을 연달아 push), 두 실행이 모두
 * 새 마이그레이션을 미적용으로 판단해 같은 DDL을 실행하다 한쪽이 실패할 수 있습니다.
 * 세션 단위 advisory lock을 잡은 뒤에 적용 이력을 읽으므로, 나중 실행은 앞 실행이 끝날 때까지 기다렸다가
 * 이미 적용된 것을 확인하고 넘어갑니다.
 *
 * 실행: pnpm db:migrate (로컬), Vercel 빌드(vercel-build)
 */
import { Client } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { getEndpointId, getMigrationUrl } from "../src/db/connection-urls";

// hashtext('yusi_blog:migrations')와 같은 목적의 고정 키. 이 저장소의 마이그레이션만 이 키로 잠급니다.
const LOCK_KEY = 7_210_417_231;
const migrationsFolder = process.argv[2] ?? "drizzle";

const url = getMigrationUrl();
if (!url) {
  console.error("DATABASE_URL(_UNPOOLED)이 없습니다. .env.example을 참고해 .env.local을 만드세요.");
  process.exit(1);
}

const client = new Client(url);
await client.connect();
console.log(`마이그레이션 대상: ${getEndpointId(url)} (${migrationsFolder})`);

try {
  const started = Date.now();
  const { rows } = await client.query<{ locked: boolean }>(
    "select pg_try_advisory_lock($1) as locked",
    [LOCK_KEY],
  );
  if (!rows[0].locked) {
    console.log("다른 마이그레이션이 실행 중이라 끝날 때까지 기다립니다.");
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    console.log(`잠금 획득 (${Date.now() - started}ms 대기)`);
  }

  await migrate(drizzle({ client }), { migrationsFolder });
  console.log(`마이그레이션 완료 (${Date.now() - started}ms)`);
} finally {
  await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await client.end();
}
