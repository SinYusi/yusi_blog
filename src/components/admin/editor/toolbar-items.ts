/*
 * 에디터 툴바의 모양(버튼 글자, 이름, 단축키)과 스타일. 에디터(post-editor.tsx)와 자리 표시(editor-skeleton.tsx)가
 * 같은 값을 써서, 에디터가 준비되면서 툴바 높이(좁은 화면에서는 여러 줄)가 바뀌어 본문이 밀리지 않게 합니다.
 * 명령 실행은 Tiptap이 필요하므로 post-editor.tsx에서 id로 연결합니다.
 */

export type ToolbarItem = {
  id: ToolId;
  label: string;
  content: string;
  className?: string;
  /** Mod(맥 ⌘, 그 외 Ctrl)와 함께 누르는 키. Tiptap 기본 단축키와 같은 조합입니다(링크 Mod-K만 직접 추가). */
  keys: readonly string[];
};

export type ToolId =
  | "paragraph"
  | "h2"
  | "h3"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "bold"
  | "italic"
  | "code"
  | "link";

export const LINK_KEYS = ["K"] as const;

export const TOOLBAR_ITEMS: (ToolbarItem | "separator")[] = [
  { id: "paragraph", label: "본문", content: "본문", keys: ["Alt", "0"] },
  { id: "h2", label: "소제목 2", content: "H2", keys: ["Alt", "2"] },
  { id: "h3", label: "소제목 3", content: "H3", keys: ["Alt", "3"] },
  { id: "bulletList", label: "글머리 목록", content: "• 목록", keys: ["Shift", "8"] },
  { id: "orderedList", label: "번호 목록", content: "1. 목록", keys: ["Shift", "7"] },
  { id: "blockquote", label: "인용", content: "인용", keys: ["Shift", "B"] },
  "separator",
  { id: "bold", label: "굵게", content: "B", className: "font-bold", keys: ["B"] },
  { id: "italic", label: "기울임", content: "I", className: "italic", keys: ["I"] },
  { id: "code", label: "인라인 코드", content: "</>", keys: ["E"] },
  { id: "link", label: "링크", content: "링크", keys: LINK_KEYS },
];

/** 구분선을 뺀 버튼만. 툴바 안 화살표 이동의 순서(roving tabindex)에 씁니다. */
export const TOOLBAR_BUTTONS = TOOLBAR_ITEMS.filter((item) => item !== "separator");

export const toolbarClass =
  "sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-bg p-1";

export const toolButtonClass =
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-3 font-mono text-meta text-muted hover:bg-surface hover:text-fg aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg";

export const separatorClass = "mx-1 h-6 w-px bg-border";
