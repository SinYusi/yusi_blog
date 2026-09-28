import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { getMigrationUrl } from "./src/db/connection-urls";

// Next.js와 같은 규칙으로 .env.local 등을 읽습니다.
loadEnvConfig(process.cwd());

// 연결 주소 선택 규칙은 마이그레이션·연결 확인 스크립트와 공유합니다 (src/db/connection-urls.ts).
const url = getMigrationUrl();
if (!url) {
  throw new Error("DATABASE_URL이 없습니다. .env.example을 참고해 .env.local을 만드세요.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
