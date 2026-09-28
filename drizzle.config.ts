import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Next.js와 같은 규칙으로 .env.local 등을 읽습니다.
loadEnvConfig(process.cwd());

// 마이그레이션은 커넥션 풀러를 거치지 않는 직접 연결을 권장하므로, 있으면 UNPOOLED 주소를 씁니다.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
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
