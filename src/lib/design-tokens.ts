/**
 * /design 페이지에 보여 줄 토큰 목록입니다. 값은 src/app/globals.css에만 두고, 여기에는 이름과 용도만 둡니다.
 * Tailwind는 소스에 그대로 적힌 클래스 이름만 생성하므로, 클래스는 조합하지 않고 전체 문자열로 적습니다.
 */

export const colorTokens = [
  { name: "bg", swatch: "bg-bg", usage: "페이지 바탕" },
  { name: "surface", swatch: "bg-surface", usage: "카드, 입력칸, 사이드 패널" },
  { name: "code", swatch: "bg-code", usage: "코드 블록, 로그" },
  { name: "border", swatch: "bg-border", usage: "구분선, 기본 테두리" },
  { name: "border-strong", swatch: "bg-border-strong", usage: "강조 테두리, 모달" },
  { name: "fg", swatch: "bg-fg", usage: "기본 글자" },
  { name: "fg-secondary", swatch: "bg-fg-secondary", usage: "보조 본문, 카드 요약" },
  { name: "fg-article", swatch: "bg-fg-article", usage: "글 본문" },
  { name: "muted", swatch: "bg-muted", usage: "메타 정보, 비활성 링크" },
  { name: "accent", swatch: "bg-accent", usage: "링크, 강조, 주요 버튼" },
  { name: "accent-hover", swatch: "bg-accent-hover", usage: "호버, 포커스 링" },
  { name: "date", swatch: "bg-date", usage: "날짜, 주의" },
  { name: "danger", swatch: "bg-danger", usage: "에러" },
  { name: "success", swatch: "bg-success", usage: "성공, 발행 상태" },
] as const;

export const typeTokens = [
  { name: "display", className: "text-display", sample: "만들면서 배운 것" },
  { name: "h1", className: "text-h1", sample: "글 제목" },
  { name: "h2", className: "text-h2", sample: "본문 소제목" },
  { name: "h3", className: "text-h3", sample: "목록의 글 제목" },
  { name: "body-lg", className: "text-body-lg", sample: "글 본문은 이 크기로 씁니다." },
  { name: "body", className: "text-body", sample: "요약과 설명은 이 크기로 씁니다." },
  { name: "meta", className: "font-mono text-meta", sample: "2026-09-28 #CI #트러블슈팅" },
  { name: "caption", className: "text-caption", sample: "보조 라벨" },
] as const;

export const radiusTokens = [
  { name: "sm", className: "rounded-sm", px: 4 },
  { name: "md", className: "rounded-md", px: 6 },
  { name: "lg", className: "rounded-lg", px: 8 },
  { name: "xl", className: "rounded-xl", px: 10 },
  { name: "2xl", className: "rounded-2xl", px: 12 },
] as const;

export const breakpoints = [
  { name: "모바일", range: "~767px", prefix: "(기본)" },
  { name: "태블릿", range: "768~1023px", prefix: "md:" },
  { name: "데스크톱", range: "1024px~", prefix: "lg:" },
] as const;
