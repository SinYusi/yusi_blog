import "server-only";

import { drizzle } from "drizzle-orm/neon-http";

import { requireServerEnv } from "@/lib/env.server";

import * as schema from "./schema";

/*
 * Neon HTTP 드라이버: 쿼리마다 HTTP 요청 한 번으로 처리해 서버리스·정적 생성 환경에 맞습니다.
 * 여러 쿼리를 한 트랜잭션으로 묶어야 하는 곳(2단계 CMS)에서는 WebSocket 드라이버를 따로 둡니다.
 */
function createDb() {
  return drizzle({ connection: requireServerEnv("DATABASE_URL"), schema });
}

let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  db ??= createDb();
  return db;
}
