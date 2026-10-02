import { EditorSkeleton } from "@/components/admin/editor/editor-skeleton";

/** 글 편집 폼이 준비되기 전(세션 확인, 글·선택지 조회) 같은 자리를 차지해 레이아웃 이동을 줄입니다. */
export function PostFormSkeleton() {
  return (
    <div className="flex max-w-article flex-col gap-7" aria-busy="true">
      {["제목", "주소(slug)", "요약", "태그", "시리즈"].map((label) => (
        <div key={label} aria-hidden="true" className="flex flex-col gap-2">
          <span className="font-mono text-meta text-muted">{label}</span>
          <div className="h-11 rounded-lg border border-border bg-surface" />
        </div>
      ))}
      <EditorSkeleton />
    </div>
  );
}
