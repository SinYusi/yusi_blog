"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { readPostForm, validatePostInput, type FieldErrors } from "@/lib/admin/post-input";
import {
  deletePostById,
  getSavedScheduledAt,
  savePost,
  type PostContent,
} from "@/lib/admin/post-mutations";
import { requireAdmin } from "@/lib/auth/admin";
import {
  editorJsonToHtml,
  InvalidEditorContentError,
  parseEditorJsonString,
  prepareEditorContent,
} from "@/lib/content/editor-html";
import { renderPostHtml, type TocItem } from "@/lib/content/render";

/*
 * 관리자 글 서버 액션. 서버 액션은 화면 밖에서 직접 호출할 수 있으므로 모두 먼저 관리자인지 확인하고,
 * 화면이 보낸 값(FormData, bind한 글 id)은 하나도 믿지 않고 다시 검사합니다.
 *
 * 공개 페이지 캐시 갱신(revalidateTag)은 #39에서 더합니다. 그 전까지 공개 페이지는 cacheLife('hours')에 따라
 * 대략 한 시간 안에 바뀐 내용을 보여 줍니다(lib/content/posts.ts).
 */

export type PreviewResult =
  { ok: true; html: string; toc: TocItem[] } | { ok: false; message: string };

/**
 * 에디터 문서 미리보기. 저장할 때와 같은 변환(editorJsonToHtml)을 거친 HTML을 공개 페이지와 같은
 * renderPostHtml로 그려 돌려줍니다. DB에는 쓰지 않습니다.
 */
/** @param contentJson serializeEditorDoc(editor.getJSON())로 만든 JSON 문자열 (객체를 그대로 보내면 안 되는 이유는 transport.ts) */
export async function previewPost(contentJson: unknown): Promise<PreviewResult> {
  await requireAdmin();

  let contentHtml: string;
  try {
    contentHtml = editorJsonToHtml(parseEditorJsonString(contentJson));
  } catch (error) {
    if (error instanceof InvalidEditorContentError) {
      return { ok: false, message: "본문 형식이 올바르지 않아 미리보기를 만들지 못했습니다." };
    }
    throw error;
  }

  const { html, toc } = await renderPostHtml(contentHtml);
  return { ok: true, html, toc };
}

/** 글 저장 폼의 상태 (useActionState). 화면에 그릴 값만 담습니다. */
export type PostFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: FieldErrors }
  | { status: "saved"; message: string; savedAt: string };

function isPostId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function invalid(fieldErrors: FieldErrors): PostFormState {
  return {
    status: "error",
    message: `저장하지 못했습니다. 아래 ${Object.keys(fieldErrors).length}개 항목을 확인하세요.`,
    fieldErrors,
  };
}

const UNEXPECTED_ERROR: PostFormState = {
  status: "error",
  message: "저장 중 오류가 났습니다. 잠시 후 다시 시도하세요. 입력한 내용은 그대로 남아 있습니다.",
  fieldErrors: {},
};

type SaveOutcome = { state: PostFormState } | { createdId: number };

async function save(id: number | null, formData: FormData): Promise<SaveOutcome> {
  const now = new Date();
  const saved = id === null ? null : await getSavedScheduledAt(id);
  const parsed = validatePostInput(readPostForm(formData), now, saved);
  const errors: FieldErrors = parsed.ok ? {} : { ...parsed.errors };

  // 본문은 serializeEditorDoc으로 만든 JSON 문자열입니다(lib/editor/transport.ts). 서버가 스키마로 검사하고 HTML을 다시 만듭니다.
  // 본문 필드가 없으면 기존 본문을 그대로 둡니다. 에디터 원본이 없는 글(HTML로만 넣은 시드 글)은 본문을 보내지 않습니다.
  let content: PostContent = null;
  const rawContent = formData.get("content");
  if (rawContent !== null) {
    try {
      content = prepareEditorContent(parseEditorJsonString(rawContent));
    } catch (error) {
      if (!(error instanceof InvalidEditorContentError)) throw error;
      errors.content = "본문 형식이 올바르지 않아 저장하지 못했습니다.";
    }
  } else if (id === null) {
    errors.content = "본문을 받지 못했습니다. 에디터가 준비된 뒤 다시 저장하세요.";
  }

  if (!parsed.ok || Object.keys(errors).length > 0) return { state: invalid(errors) };

  let result: Awaited<ReturnType<typeof savePost>>;
  try {
    result = await savePost({ id, input: parsed.value, content, now });
  } catch (error) {
    // 예상하지 못한 오류(DB 연결 등)도 오류 경계로 화면을 바꾸지 않고 폼에 알려, 입력한 내용을 잃지 않게 합니다.
    unstable_rethrow(error);
    console.error("글 저장 실패", error);
    return { state: UNEXPECTED_ERROR };
  }
  if (!result.ok) {
    if ("notFound" in result) {
      return {
        state: {
          status: "error",
          message: "글을 찾을 수 없습니다. 다른 곳에서 삭제되었을 수 있습니다.",
          fieldErrors: {},
        },
      };
    }
    return { state: invalid(result.errors) };
  }
  if (id === null) return { createdId: result.id };

  return {
    state: {
      status: "saved",
      message: result.changed ? "저장했습니다." : "바뀐 내용이 없어 저장하지 않았습니다.",
      savedAt: now.toISOString(),
    },
  };
}

export async function createPostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  await requireAdmin();
  const outcome = await save(null, formData);
  if ("state" in outcome) return outcome.state;
  // redirect는 예외로 동작하므로 try 밖에서 부릅니다. 편집 화면이 저장 완료를 알립니다.
  redirect(`/admin/posts/${outcome.createdId}?created=1`);
}

export async function updatePostAction(
  id: unknown,
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  await requireAdmin();
  if (!isPostId(id)) {
    return { status: "error", message: "잘못된 글 id입니다.", fieldErrors: {} };
  }
  const outcome = await save(id, formData);
  if ("createdId" in outcome) throw new Error("수정 요청이 새 글을 만들었습니다.");
  // 머리글의 상태 배지, 공개 페이지 링크 등 서버에서 그린 부분을 저장된 값으로 다시 그립니다.
  if (outcome.state.status === "saved") refresh();
  return outcome.state;
}

export type DeletePostState = { status: "idle" } | { status: "error"; message: string };

/** 글 삭제. 확인 대화상자의 폼에서 부릅니다. 성공하면 글 목록으로 이동합니다. */
export async function deletePostAction(
  id: unknown,
  _prev: DeletePostState,
  _formData: FormData,
): Promise<DeletePostState> {
  await requireAdmin();
  if (!isPostId(id)) return { status: "error", message: "잘못된 글 id입니다." };

  let deleted: Awaited<ReturnType<typeof deletePostById>>;
  try {
    deleted = await deletePostById(id);
  } catch (error) {
    unstable_rethrow(error);
    console.error("글 삭제 실패", error);
    return { status: "error", message: "삭제 중 오류가 났습니다. 잠시 후 다시 시도하세요." };
  }
  if (!deleted)
    return { status: "error", message: "글을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다." };
  redirect("/admin?deleted=1");
}
