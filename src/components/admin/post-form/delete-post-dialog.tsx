"use client";

import { useActionState, useRef } from "react";

import { deletePostAction, type DeletePostState } from "@/app/admin/(panel)/posts/actions";

import { dangerButtonClass, secondaryButtonClass } from "./styles";

/**
 * 글 삭제 확인 대화상자 (네이티브 <dialog>, showModal).
 * 모달로 열면 브라우저가 바깥 내용을 비활성화(inert)하고, Esc로 닫히며, 닫히면 여는 버튼으로 초점을 돌려줍니다.
 * 열 때 초점은 되돌릴 수 있는 '취소'에 둡니다. 실수로 Enter를 눌러도 지워지지 않게 하기 위해서입니다.
 */
export function DeletePostDialog({
  postId,
  title,
  isPublic,
}: {
  postId: number;
  title: string;
  isPublic: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState<DeletePostState, FormData>(
    deletePostAction.bind(null, postId),
    { status: "idle" },
  );

  return (
    <section aria-labelledby="delete-post-heading" className="flex max-w-article flex-col gap-3">
      <h2 id="delete-post-heading" className="font-mono text-meta text-muted">
        글 삭제
      </h2>
      <div>
        <button
          type="button"
          onClick={() => {
            dialogRef.current?.showModal();
            cancelRef.current?.focus();
          }}
          className={dangerButtonClass}
        >
          이 글 삭제…
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        // 삭제 요청 중에는 Esc로 닫지 않습니다(결과를 볼 수 있게).
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="m-auto w-11/12 max-w-md rounded-2xl border border-border-strong bg-surface p-6 text-fg backdrop:bg-bg/80"
      >
        <form action={formAction} className="flex flex-col gap-4">
          <h2 id="delete-dialog-title" className="text-h3">
            이 글을 삭제할까요?
          </h2>
          <div
            id="delete-dialog-description"
            className="flex flex-col gap-2 text-body text-fg-secondary"
          >
            <p>
              <strong className="text-fg">{title}</strong>을(를) 지웁니다. 되돌릴 수 없습니다.
            </p>
            <p>
              태그 연결과 이전 주소 리다이렉트도 함께 지워집니다. 태그와 시리즈 자체는 남고, 이 글이
              쓰던 시리즈 순번은 비게 됩니다.
              {isPublic && " 공개 페이지에서는 캐시가 갱신될 때(최대 한 시간쯤) 사라집니다."}
            </p>
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-meta text-danger">
              {state.message}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <button
              ref={cancelRef}
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              className={secondaryButtonClass}
            >
              취소
            </button>
            <button type="submit" disabled={pending} className={dangerButtonClass}>
              {pending ? "삭제하는 중…" : "삭제"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
