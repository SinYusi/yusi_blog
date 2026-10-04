/*
 * 본문 링크 주소 허용 정책. 에디터의 Link 확장(직접 입력, 붙여넣기, 자동 링크)과 서버 HTML 생성이 같은 규칙을 씁니다.
 * 허용: http, https, mailto 스킴과 스킴이 없는 주소(상대 경로, #앵커, ?쿼리).
 * 렌더링 단계(render.ts)의 정화가 허용하는 스킴(rehype-sanitize 기본값)보다 좁으므로, 여기서 통과한 주소는 정화 뒤에도 남습니다.
 */

export const ALLOWED_LINK_PROTOCOLS = ["http", "https", "mailto"] as const;

// 브라우저는 URL을 해석할 때 앞뒤의 제어 문자·공백을 버리고, 중간의 탭·줄바꿈도 지웁니다.
// (" JaVaScRiPt:", "java\tscript:"도 javascript: 스킴으로 동작) 스킴을 판단하기 전에 똑같이 지웁니다.
const IGNORED_URL_CHARS = /[\u0000- \u007f]/g;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

export function isAllowedLinkHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  const compact = href.replace(IGNORED_URL_CHARS, "");
  if (!compact) return false;

  const scheme = SCHEME.exec(compact)?.[1].toLowerCase();
  if (scheme === undefined) return true; // 스킴 없음: 상대 경로, #앵커, ?쿼리
  return (ALLOWED_LINK_PROTOCOLS as readonly string[]).includes(scheme);
}
