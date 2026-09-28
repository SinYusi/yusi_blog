import "server-only";

/**
 * 서버에서만 읽는 환경 변수. 값이 없으면 사용하는 시점에 원인을 알 수 있는 에러를 냅니다.
 * 빌드나 import만으로는 에러가 나지 않도록 함수로 읽습니다.
 */
export function requireServerEnv(name: "DATABASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경 변수 ${name}가 없습니다. 로컬은 .env.local, 배포 환경은 Vercel 프로젝트 설정을 확인하세요 (.env.example 참고).`,
    );
  }
  return value;
}
