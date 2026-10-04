import { separatorClass, TOOLBAR_ITEMS, toolbarClass, toolButtonClass } from "./toolbar-items";

/**
 * 에디터가 준비되기 전(세션 확인, 브라우저에서 에디터 생성) 같은 자리를 차지해 레이아웃 이동을 줄입니다.
 * 툴바는 실제 툴바와 같은 버튼 글자·스타일로 그려, 좁은 화면에서 여러 줄로 감길 때도 높이가 같습니다.
 */
export function EditorSkeleton() {
  return (
    <div className="flex max-w-article flex-col gap-4" aria-busy="true">
      <div className="h-11 w-40 rounded-lg bg-surface" />
      <div className="flex flex-col gap-3">
        <div aria-hidden="true" className={toolbarClass}>
          {TOOLBAR_ITEMS.map((item, position) =>
            item === "separator" ? (
              <span key={`separator-${position}`} className={separatorClass} />
            ) : (
              <span key={item.id} className={`${toolButtonClass} ${item.className ?? ""}`}>
                {item.content}
              </span>
            ),
          )}
        </div>
        <div className="flex min-h-96 items-start rounded-xl border border-border-strong bg-surface px-5 py-6 md:px-8">
          <p role="status" className="text-body text-muted">
            에디터를 불러오는 중입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
