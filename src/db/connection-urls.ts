/**
 * DB 연결 주소 선택 규칙. drizzle-kit 설정, 마이그레이션, 연결 확인 스크립트가 모두 이 규칙을 씁니다.
 * (규칙이 파일마다 다르면 확인한 DB와 실제로 마이그레이션되는 DB가 달라질 수 있습니다.)
 */
type Env = Record<string, string | undefined>;

/** 앱의 쿼리가 쓰는 주소 (커넥션 풀러 경유) */
export function getAppUrl(env: Env = process.env) {
  return env.DATABASE_URL;
}

/**
 * 마이그레이션 대상 주소. 직접 연결 주소를 우선 쓰고, 없으면 앱 주소에서 풀러(-pooler)를 뺀 직접 연결로 바꿉니다.
 * 마이그레이션은 세션 단위 잠금(advisory lock)을 쓰므로, 트랜잭션 단위로 연결을 돌려쓰는 풀러를 거치면 안 됩니다.
 */
export function getMigrationUrl(env: Env = process.env) {
  const raw = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  return url.toString();
}

/** Neon 엔드포인트 ID (예: ep-crimson-moon-b34cyx5a). 풀러 여부와 상관없이 같은 DB 브랜치면 같은 값입니다. */
export function getEndpointId(url: string) {
  return new URL(url).hostname.split(".")[0].replace(/-pooler$/, "");
}

/** URL 경로의 데이터베이스 이름 (예: /neondb → neondb) */
export function getDatabaseName(url: string) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/**
 * 앱 쿼리 대상과 마이그레이션 대상이 같은 DB(엔드포인트 + 데이터베이스 이름)인지 확인합니다.
 * 다르면 이유를 담은 메시지를, 같으면 null을 반환합니다. 확인한 DB와 실제로 마이그레이션되는 DB가
 * 달라지는 일을 막기 위해 db:check와 마이그레이션 스크립트가 모두 이 검사를 거칩니다.
 */
export function findTargetMismatch(appUrl: string, migrationUrl: string) {
  const app = `${getEndpointId(appUrl)}/${getDatabaseName(appUrl)}`;
  const migration = `${getEndpointId(migrationUrl)}/${getDatabaseName(migrationUrl)}`;
  return app === migration
    ? null
    : `앱 쿼리 대상(${app})과 마이그레이션 대상(${migration})이 서로 다른 DB입니다. DATABASE_URL과 DATABASE_URL_UNPOOLED가 같은 Neon 브랜치·데이터베이스를 가리키는지 확인하세요.`;
}
