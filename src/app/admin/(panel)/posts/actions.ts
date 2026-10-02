"use server";

import { requireAdmin } from "@/lib/auth/admin";
import {
  editorJsonToHtml,
  InvalidEditorContentError,
  parseEditorJsonString,
} from "@/lib/content/editor-html";
import { renderPostHtml, type TocItem } from "@/lib/content/render";

export type PreviewResult =
  { ok: true; html: string; toc: TocItem[] } | { ok: false; message: string };

/**
 * 에디터 문서 미리보기. 저장할 때와 같은 변환(editorJsonToHtml)을 거친 HTML을 공개 페이지와 같은
 * renderPostHtml로 그려 돌려줍니다. DB에는 쓰지 않습니다(저장·발행은 #38).
 * 서버 액션은 화면 밖에서 직접 호출할 수 있으므로 먼저 관리자인지 확인합니다.
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
