/** 에디터가 준비되기 전(세션 확인, 브라우저에서 에디터 생성) 같은 자리를 차지해 레이아웃 이동을 줄입니다. */
export function EditorSkeleton() {
  return (
    <div className="flex max-w-article flex-col gap-4" aria-busy="true">
      <div className="h-11 w-40 rounded-lg bg-surface" />
      <div className="h-13 rounded-xl border border-border bg-bg" />
      <div className="flex min-h-96 items-start rounded-xl border border-border-strong bg-surface px-5 py-6 md:px-8">
        <p role="status" className="text-body text-muted">
          에디터를 불러오는 중입니다.
        </p>
      </div>
    </div>
  );
}
