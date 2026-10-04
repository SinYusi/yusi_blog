import type { BundledLanguage } from "shiki";

/*
 * 코드 블록 언어 목록. 공개 렌더링(render.ts, Shiki 하이라이트)과 에디터의 언어 선택이 같은 목록을 씁니다.
 * 목록에 없는 언어는 렌더링 때 하이라이트 없이 text로 보입니다.
 */

export const SUPPORTED_LANGUAGES = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "bash",
  "yaml",
  "python",
  "css",
  "html",
  "sql",
  "diff",
  "markdown",
] as const satisfies BundledLanguage[];

/** 하이라이트 없이 로그 모양(흐린 글자)으로 보이는 코드 블록 종류. data-language="log"로 저장합니다. */
export const LOG_LANGUAGE = "log";

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

/** 저장된 언어 값을 지원 목록의 이름으로 바꿉니다. 별칭(ts 등)을 풀고, 목록에 없으면 null입니다. */
export function resolveLanguage(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  const name = LANGUAGE_ALIASES[raw] ?? raw;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(name)
    ? (name as BundledLanguage)
    : null;
}
