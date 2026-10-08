import { Node, type Extensions, type NodeViewRenderer } from "@tiptap/core";
import { CodeBlock } from "@tiptap/extension-code-block";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";

import { isAllowedLinkHref } from "./link-policy";

/*
 * 에디터 확장 구성. 관리자 에디터(클라이언트)와 content_html 생성(서버, lib/content/editor-html.ts)이
 * 같은 구성을 써야 에디터가 만든 문서(JSON)를 서버가 같은 스키마로 해석합니다. 확장을 바꾸면 두 쪽이 함께 바뀝니다.
 *
 * 지금 쓰는 것: 문단, h2/h3, 글머리·번호 목록, 인용, 링크, 굵게, 기울임, 인라인 코드, 줄바꿈(Shift+Enter),
 * 코드 블록(pre[data-language][data-filename]), 콜아웃(aside[data-callout]), 이미지(figure > img + figcaption, ADR-0010). 본문 HTML 규칙은 seed-data.ts 상단에 있습니다.
 * 공개 본문 규칙에 없는 서식(취소선, 밑줄, 구분선)은 끕니다.
 */

/** 본문에서 쓰는 소제목 단계. h1은 글 제목이 쓰므로 본문은 h2부터 시작합니다. */
export const HEADING_LEVELS = [2, 3] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const CALLOUT_TYPES = ["info", "warning", "danger"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

/**
 * 콜아웃 안(목록 속 포함)에 둘 수 있는 블록. 콜아웃의 직접 자식은 content 규칙으로 제한되지만, 목록 항목은 첫 문단 뒤에
 * 어떤 블록이든 받으므로 스키마만으로는 콜아웃 > 목록 > 소제목·인용·코드 블록을 막지 못합니다.
 * 그래서 허용 목록으로 문서 전체를 검사합니다: 에디터는 이를 어기는 변경(툴바, 붙여넣기, 슬래시 메뉴 등 모든 경로)을
 * 적용하지 않고, 서버(editor-html.ts)는 저장을 거부합니다. 공개 스타일이 문단·목록만 전제하고, 소제목은 목차에 섞이기 때문입니다.
 */
export const CALLOUT_ALLOWED_BLOCKS: readonly string[] = [
  "paragraph",
  "bulletList",
  "orderedList",
  "listItem",
];

/** 콜아웃 안에 허용하지 않는 블록이 있으면 true. */
export function hasInvalidCalloutContent(doc: ProseMirrorNode) {
  let invalid = false;
  doc.descendants((node) => {
    if (invalid) return false;
    if (node.type.name !== "callout") return true;
    node.descendants((child) => {
      if (child.isBlock && !CALLOUT_ALLOWED_BLOCKS.includes(child.type.name)) invalid = true;
      return !invalid;
    });
    return false;
  });
  return invalid;
}

/** 코드 블록 파일명 최대 길이. 에디터 입력칸과 서버 검사(editor-html.ts)가 같은 값을 씁니다. */
export const CODE_FILENAME_MAX = 100;

export function isCalloutType(value: unknown): value is CalloutType {
  return (CALLOUT_TYPES as readonly unknown[]).includes(value);
}

/** 에디터에서 블록을 편집하는 화면(React NodeView). 서버는 HTML만 만들므로 넘기지 않습니다. */
export type EditorNodeViews = {
  codeBlock?: NodeViewRenderer;
  callout?: NodeViewRenderer;
  image?: NodeViewRenderer;
};

export function createEditorExtensions(nodeViews: EditorNodeViews = {}): Extensions {
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
        // 직접 입력·붙여넣기·자동 링크와 HTML 생성(renderHTML) 모두 같은 허용 정책(link-policy.ts)을 따릅니다.
        // 허용되지 않은 주소는 setLink가 실패하고, 렌더링 때는 href가 비워집니다.
        isAllowedUri: (url) => isAllowedLinkHref(url),
        // 본문 링크는 같은 창에서 엽니다. target·rel은 정화 단계(render.ts)에서도 지워지므로 처음부터 넣지 않습니다.
        HTMLAttributes: { target: null, rel: null },
      },
    }),
    // 코드 블록: 언어는 data-language, 파일명은 data-filename에 둡니다(본문 HTML 규칙).
    // 지원 목록(code-languages.ts)에 없는 언어(```rust, VS Code 붙여넣기 등)도 그대로 저장되고, 공개 페이지에서는 text로 보입니다.
    CodeBlock.extend({
      addAttributes() {
        return {
          language: {
            default: null,
            // 다른 사이트에서 붙여넣은 코드는 <code class="language-x">로 언어를 표시하는 경우가 많아 함께 읽습니다.
            parseHTML: (element) =>
              element.getAttribute("data-language") ??
              element.firstElementChild?.className.match(/language-(\S+)/)?.[1] ??
              null,
            renderHTML: (attributes) => ({ "data-language": attributes.language }),
          },
          filename: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-filename"),
            renderHTML: (attributes) => ({ "data-filename": attributes.filename }),
          },
        };
      },
      renderHTML({ HTMLAttributes }) {
        return ["pre", HTMLAttributes, ["code", 0]];
      },
      addNodeView: nodeViews.codeBlock && (() => nodeViews.codeBlock!),
    }),
    Node.create({
      name: "callout",
      group: "block",
      // 공개 스타일은 문단·목록을 전제로 합니다. 목록 안으로 들어오는 블록은 CALLOUT_ALLOWED_BLOCKS로 따로 막습니다.
      content: "(paragraph | bulletList | orderedList)+",
      defining: true,
      addAttributes() {
        return {
          type: {
            default: "info" satisfies CalloutType,
            parseHTML: (element) => {
              const type = element.getAttribute("data-callout");
              return isCalloutType(type) ? type : "info";
            },
            renderHTML: (attributes) => ({ "data-callout": attributes.type }),
          },
        };
      },
      parseHTML() {
        return [{ tag: "aside[data-callout]" }];
      },
      renderHTML({ HTMLAttributes }) {
        return ["aside", HTMLAttributes, 0];
      },
      addNodeView: nodeViews.callout && (() => nodeViews.callout!),
      addProseMirrorPlugins() {
        return [
          new Plugin({
            // ponytail: 문서가 바뀔 때마다 전체를 훑습니다(글 한 편 크기면 충분). 느려지면 바뀐 범위의 콜아웃만 검사.
            filterTransaction: (tr) => !tr.docChanged || !hasInvalidCalloutContent(tr.doc),
          }),
        ];
      },
    }),
    // 이미지: 주소(Blob 공개 저장소, image-policy.ts)·원본 크기·대체 텍스트·캡션을 속성으로 둡니다.
    // 크기는 공개 페이지가 자리를 미리 잡아 레이아웃 이동이 없도록 업로드할 때 브라우저에서 읽어 넣습니다.
    Node.create({
      name: "image",
      group: "block",
      atom: true,
      draggable: true,
      addAttributes() {
        return {
          src: { default: null },
          alt: { default: "" },
          width: { default: null },
          height: { default: null },
          caption: { default: "" },
          // 업로드 중인 자리 표시: 붙여넣는 순간 이 id와 미리보기 주소로 넣었다가, 업로드가 끝나면 실제 주소로 바꾸고 지웁니다.
          // HTML로는 내보내지 않습니다. 업로드 중에는 글을 저장하지 않으므로 저장된 문서에는 남지 않습니다.
          uploadId: { default: null, rendered: false },
        };
      },
      // 에디터 안 복사·붙여넣기만 되살립니다. 다른 사이트의 <img>는 저장소 밖 주소라 받지 않습니다.
      parseHTML() {
        return [
          {
            tag: "figure[data-post-image]",
            getAttrs: (element) => {
              const img = element.querySelector("img");
              if (!img) return false;
              // 업로드 중인 자리 표시(blob: 미리보기 주소)를 복사해 붙여넣은 사본은 실제 주소로 바뀌지 않으므로 받지 않습니다.
              const src = img.getAttribute("src");
              if (!src || src.startsWith("blob:")) return false;
              return {
                src,
                alt: img.getAttribute("alt") ?? "",
                width: Number(img.getAttribute("width")) || null,
                height: Number(img.getAttribute("height")) || null,
                caption: element.querySelector("figcaption")?.textContent ?? "",
              };
            },
          },
        ];
      },
      renderHTML({ node }) {
        const { src, alt, width, height, caption } = node.attrs;
        const img = ["img", { src, alt, width, height }] as const;
        return caption
          ? ["figure", { "data-post-image": "" }, img, ["figcaption", {}, caption]]
          : ["figure", { "data-post-image": "" }, img];
      },
      addNodeView: nodeViews.image && (() => nodeViews.image!),
    }),
  ];
}
