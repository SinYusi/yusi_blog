// 글 편집 폼에서 같이 쓰는 클래스. 오류가 있는 칸은 aria-invalid로 테두리 색을 바꿉니다.
export const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-body text-fg placeholder:text-muted disabled:opacity-60 aria-[invalid=true]:border-danger";

export const labelClass = "font-mono text-meta text-muted";

export const hintClass = "text-caption text-muted";

export const errorClass = "text-meta text-danger";

export const primaryButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-fg px-5 text-body font-semibold text-bg hover:bg-fg-secondary disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border-strong px-4 text-body text-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-danger px-4 text-body text-danger disabled:cursor-not-allowed disabled:opacity-60";
