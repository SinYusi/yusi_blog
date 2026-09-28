// DB 연결 확인: 앱이 쓰는 DB와 마이그레이션 대상 DB를 모두 보여 주고, 서로 다르면 실패합니다.
// 실행: pnpm db:check (.env.local 사용). 마이그레이션 전에 대상이 운영이 아닌지 이 명령으로 확인합니다.
import { neon } from "@neondatabase/serverless";

import { getAppUrl, getEndpointId, getMigrationUrl } from "../src/db/connection-urls";

const appUrl = getAppUrl();
const migrationUrl = getMigrationUrl();
if (!appUrl || !migrationUrl) {
  console.error("DATABASE_URL이 없습니다. .env.example을 참고해 .env.local을 만드세요.");
  process.exit(1);
}

const appEndpoint = getEndpointId(appUrl);
const migrationEndpoint = getEndpointId(migrationUrl);

const sql = neon(appUrl);
const started = performance.now();
const [row] =
  await sql`select current_database() as database, current_user as "user", version() as version`;
const elapsed = Math.round(performance.now() - started);

console.log(`앱 쿼리 대상:        ${appEndpoint} (${new URL(appUrl).hostname})`);
console.log(`마이그레이션 대상:   ${migrationEndpoint} (${new URL(migrationUrl).hostname})`);
console.log(`database: ${row.database}, user: ${row.user}`);
console.log(`server:   ${String(row.version).split(",")[0]}`);
console.log(`응답 시간: ${elapsed}ms (자동으로 멈춰 있던 경우 첫 요청은 더 오래 걸립니다)`);

if (appEndpoint !== migrationEndpoint) {
  console.error(
    "\n✗ 앱 쿼리 대상과 마이그레이션 대상이 서로 다른 DB입니다. .env.local의 DATABASE_URL과 DATABASE_URL_UNPOOLED가 같은 Neon 브랜치를 가리키는지 확인하세요.",
  );
  process.exit(1);
}
