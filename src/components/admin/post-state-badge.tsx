import type { AdminPostState } from "@/lib/admin/posts";

const STATE_BADGE: Record<AdminPostState, { label: string; dot: string; text: string }> = {
  published: { label: "발행", dot: "bg-success", text: "text-success" },
  scheduled: { label: "예약", dot: "bg-date", text: "text-date" },
  draft: { label: "초안", dot: "bg-muted", text: "text-muted" },
};

/** 관리자 화면의 글 상태 표시 (글 목록, 편집 화면 머리글) */
export function PostStateBadge({ state }: { state: AdminPostState }) {
  const badge = STATE_BADGE[state];
  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full border border-border-strong px-3 py-1 font-mono text-caption ${badge.text}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${badge.dot}`} />
      {badge.label}
    </span>
  );
}
