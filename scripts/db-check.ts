// DB 연결 확인: 어느 DB(브랜치)에 연결되는지와 서버 버전을 출력합니다.
// 실행: pnpm db:check (.env.local의 DATABASE_URL 사용)
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 없습니다. .env.example을 참고해 .env.local을 만드세요.");
  process.exit(1);
}

const sql = neon(url);
const started = performance.now();
const [row] =
  await sql`select current_database() as database, current_user as "user", version() as version`;
const elapsed = Math.round(performance.now() - started);

console.log(`host:     ${new URL(url).hostname}`);
console.log(`database: ${row.database}`);
console.log(`user:     ${row.user}`);
console.log(`server:   ${String(row.version).split(",")[0]}`);
console.log(`응답 시간: ${elapsed}ms (자동으로 멈춰 있던 경우 첫 요청은 더 오래 걸립니다)`);
