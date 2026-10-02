import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

/*
 * 에디터 확장 구성. 관리자 에디터(클라이언트)와 content_html 생성(서버, lib/content/editor-html.ts)이
 * 같은 구성을 써야 에디터가 만든 문서(JSON)를 서버가 같은 스키마로 해석합니다. 확장을 바꾸면 두 쪽이 함께 바뀝니다.
 *
 * 지금 쓰는 것: 문단, h2/h3, 글머리·번호 목록, 인용, 링크, 굵게, 기울임, 인라인 코드, 줄바꿈(Shift+Enter).
 * 코드 블록과 콜아웃은 본문 규칙(pre[data-language][data-filename], aside[data-callout])에 맞춰 #42에서 추가합니다.
 * 공개 본문 규칙에 없는 서식(취소선, 밑줄, 구분선)은 끕니다.
 */

/** 본문에서 쓰는 소제목 단계. h1은 글 제목이 쓰므로 본문은 h2부터 시작합니다. */
export const HEADING_LEVELS = [2, 3] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export function createEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        // 본문 링크는 같은 창에서 엽니다. target·rel은 정화 단계(render.ts)에서도 지워지므로 처음부터 넣지 않습니다.
        HTMLAttributes: { target: null, rel: null },
      },
    }),
  ];
}
