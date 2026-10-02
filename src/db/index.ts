import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";

import { requireServerEnv } from "@/lib/env.server";

import * as schema from "./schema";

/*
 * Neon HTTP 드라이버: 쿼리마다 HTTP 요청 한 번으로 처리해 서버리스·정적 생성 환경에 맞습니다.
 * 여러 쿼리를 한 트랜잭션으로 묶어야 하는 곳(관리자 글 저장·삭제)은 아래 withTransaction(WebSocket 드라이버)을 씁니다.
 */
function createDb() {
  return drizzle({ connection: requireServerEnv("DATABASE_URL"), schema });
}

let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  db ??= createDb();
  return db;
}

function createTransactionDb(pool: Pool) {
  return drizzleWs({ client: pool, schema });
}

export type Transaction = Parameters<
  Parameters<ReturnType<typeof createTransactionDb>["transaction"]>[0]
>[0];

/**
 * 대화형 트랜잭션. 앞 쿼리의 결과(새 글 id, 기존 태그 등)로 다음 쿼리를 정해야 해서 HTTP 드라이버의 batch로는 묶을 수 없습니다.
 * 서버리스 환경에서는 WebSocket 연결이 요청을 넘어 살아남지 못하므로, 호출마다 풀을 만들고 끝나면 닫습니다
 * (@neondatabase/serverless README "Pool and Client"). Node 22 이상은 내장 WebSocket을 쓰므로 ws 패키지가 필요 없습니다.
 * 콜백이 예외를 던지면 롤백합니다.
 */
export async function withTransaction<T>(run: (tx: Transaction) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: requireServerEnv("DATABASE_URL") });
  // 쉬고 있는 연결의 오류는 풀이 'error' 이벤트로 알립니다. 듣는 쪽이 없으면 프로세스가 종료되므로 기록만 합니다.
  pool.on("error", (error: Error) => console.error("DB 연결 풀 오류", error));
  try {
    return await createTransactionDb(pool).transaction(run);
  } finally {
    await pool.end();
  }
}
