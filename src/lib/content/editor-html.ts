import "server-only";

import { getSchema } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  renderToHTMLString,
  serializeAttrsToHTMLString,
  serializeChildrenToHTMLString,
} from "@tiptap/static-renderer/pm/html-string";

import {
  CODE_FILENAME_MAX,
  createEditorExtensions,
  HEADING_LEVELS,
  hasInvalidCalloutContent,
  isCalloutType,
} from "@/lib/editor/extensions";
import {
  IMAGE_ALT_MAX,
  IMAGE_CAPTION_MAX,
  isAllowedImageSrc,
  isImageDimension,
} from "@/lib/editor/image-policy";
import { MAX_EDITOR_JSON_BYTES } from "@/lib/editor/transport";

/*
 * 에디터 원본(posts.content, Tiptap JSON)으로 공개용 본문 HTML(posts.content_html)을 만듭니다 (ADR-0011).
 * - 클라이언트가 보낸 HTML은 믿지 않고, 서버가 JSON을 에디터와 같은 스키마로 검사한 뒤 HTML을 다시 만듭니다.
 * - 결과는 seed-data.ts 상단의 본문 HTML 규칙을 따르므로, 공개 페이지는 시드 글과 같은 renderPostHtml
 *   (정화 → 코드 하이라이트 → 목차)로 그립니다. 정화는 그 단계에서 한 번 더 합니다.
 * - DOM 없이 문자열로 직렬화합니다(@tiptap/static-renderer). 서버에 DOM 구현(happy-dom 등)을 들이지 않습니다.
 */

const extensions = createEditorExtensions();
const schema = getSchema(extensions);

/** 에디터 문서가 스키마에 맞지 않을 때 던집니다. 호출하는 쪽은 사용자에게 형식 오류로 알립니다. */
export class InvalidEditorContentError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidEditorContentError";
  }
}

const MAX_ID_LENGTH = 80;
// 언어 이름(typescript 등)보다 넉넉하게. 지원 목록 밖의 값도 저장은 하고, 공개 페이지에서 text로 보입니다.
const MAX_LANGUAGE_LENGTH = 40;
const FALLBACK_ID = "section";
// tsconfig target(ES2017)에서는 정규식 리터럴의 u 플래그를 쓸 수 없어 생성자로 만듭니다.
const NON_ID_CHARS = new RegExp("[^\\p{L}\\p{M}\\p{N}\\s_-]", "gu");

/**
 * 소제목 텍스트로 id를 만듭니다. 한글 등 모든 문자(글자·숫자)를 그대로 두고, 공백은 '-'로 바꾸며,
 * 문장 부호는 지웁니다. 예: "Next.js 16의 변경 사항" → "nextjs-16의-변경-사항"
 * 렌더링 단계(render.ts)가 정화하면서 접두사(sec-)를 붙이므로, 여기서는 접두사 없이 만듭니다.
 */
export function slugifyHeading(text: string) {
  const slug = text
    .normalize("NFC")
    .toLowerCase()
    .replace(NON_ID_CHARS, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // 코드 포인트 단위로 자릅니다 (UTF-16 단위로 자르면 서로게이트 쌍이 깨질 수 있음).
  const trimmed = Array.from(slug).slice(0, MAX_ID_LENGTH).join("").replace(/-+$/, "");
  return trimmed || FALLBACK_ID;
}

/**
 * 문서 순서대로 소제목 id를 정합니다. 같은 id가 다시 나오면 -2, -3을 붙입니다.
 * 소제목 텍스트와 순서로만 정해지므로, 소제목을 바꾸지 않으면 몇 번을 저장해도 같은 id가 나옵니다.
 */
function assignHeadingIds(doc: ProseMirrorNode) {
  const ids = new Map<ProseMirrorNode, string>();
  const used = new Set<string>();

  doc.descendants((node) => {
    if (node.type.name !== "heading") return true;
    if (isBlank(node)) return false;
    const base = slugifyHeading(node.textContent);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    ids.set(node, id);
    return false;
  });
  return ids;
}

// 빈 문단·소제목은 출력하지 않습니다. 에디터는 문서 끝에 빈 문단을 항상 두고(TrailingNode),
// 빈 소제목은 목차에 빈 항목을 만들기 때문입니다. 공백 글자와 줄바꿈(hardBreak)만 있는 블록도 비어 있다고 봅니다.
// 그 밖의 인라인 노드(예: 이미지)가 생기면 내용으로 보고 남깁니다.
function isBlank(node: ProseMirrorNode) {
  let blank = true;
  node.forEach((child) => {
    if (child.isText ? (child.text ?? "").trim() !== "" : child.type.name !== "hardBreak") {
      blank = false;
    }
  });
  return blank;
}

function escapeHtml(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 에디터 JSON을 스키마로 검사해 ProseMirror 문서로 바꿉니다. 모르는 노드·마크, 잘못된 구조는 거부합니다. */
function parseEditorDoc(json: unknown) {
  if (!isPlainObject(json) || json.type !== "doc") {
    throw new InvalidEditorContentError("에디터 문서는 type이 doc인 객체여야 합니다.");
  }

  let doc: ProseMirrorNode;
  try {
    doc = ProseMirrorNode.fromJSON(schema, json);
    doc.check(); // fromJSON은 노드 종류만 확인하므로 내용 구조(예: 목록 안에는 항목만)도 검사합니다.
  } catch (error) {
    throw new InvalidEditorContentError("에디터 문서가 스키마에 맞지 않습니다.", { cause: error });
  }

  doc.descendants((node) => {
    // check()는 속성 값의 타입을 보지 않습니다. 문자열이 아닌 href는 Link 렌더러에서 예외를 내므로 여기서 거부합니다.
    for (const mark of node.marks) {
      if (
        mark.type.name === "link" &&
        mark.attrs.href !== null &&
        typeof mark.attrs.href !== "string"
      ) {
        throw new InvalidEditorContentError("링크 href는 문자열이어야 합니다.");
      }
    }
    if (
      node.type.name === "heading" &&
      !(HEADING_LEVELS as readonly unknown[]).includes(node.attrs.level)
    ) {
      throw new InvalidEditorContentError(`지원하지 않는 소제목 단계입니다: ${node.attrs.level}`);
    }
    if (node.type.name === "codeBlock") {
      const { language, filename } = node.attrs;
      if (
        language !== null &&
        (typeof language !== "string" || language.length > MAX_LANGUAGE_LENGTH)
      ) {
        throw new InvalidEditorContentError("코드 블록 언어는 짧은 문자열이어야 합니다.");
      }
      if (
        filename !== null &&
        (typeof filename !== "string" || filename.length > CODE_FILENAME_MAX)
      ) {
        throw new InvalidEditorContentError(
          `코드 블록 파일명은 ${CODE_FILENAME_MAX}자 이하의 문자열이어야 합니다.`,
        );
      }
    }
    if (node.type.name === "image") {
      const { src, alt, width, height, caption } = node.attrs;
      if (!isAllowedImageSrc(src)) {
        throw new InvalidEditorContentError("이미지는 블로그 저장소에 올린 주소만 쓸 수 있습니다.");
      }
      if (!isImageDimension(width) || !isImageDimension(height)) {
        throw new InvalidEditorContentError("이미지 크기 정보가 올바르지 않습니다.");
      }
      if (typeof alt !== "string" || alt.length > IMAGE_ALT_MAX) {
        throw new InvalidEditorContentError(`대체 텍스트는 ${IMAGE_ALT_MAX}자 이하여야 합니다.`);
      }
      if (typeof caption !== "string" || caption.length > IMAGE_CAPTION_MAX) {
        throw new InvalidEditorContentError(`캡션은 ${IMAGE_CAPTION_MAX}자 이하여야 합니다.`);
      }
    }
    if (node.type.name === "callout") {
      if (!isCalloutType(node.attrs.type)) {
        throw new InvalidEditorContentError(`지원하지 않는 콜아웃 종류입니다: ${node.attrs.type}`);
      }
    }
  });
  // 목록 항목을 거치면 스키마(content 규칙)로는 막히지 않아 허용 목록으로 따로 검사합니다(extensions.ts).
  if (hasInvalidCalloutContent(doc)) {
    throw new InvalidEditorContentError("콜아웃 안에는 문단과 목록만 넣을 수 있습니다.");
  }
  return doc;
}

/**
 * 서버 액션으로 받은 본문 JSON 문자열(lib/editor/transport.ts의 serializeEditorDoc)을 읽습니다.
 * 문자열이 아니거나, 너무 크거나, JSON이 아니면 InvalidEditorContentError를 던집니다.
 */
export function parseEditorJsonString(input: unknown): unknown {
  if (typeof input !== "string") {
    throw new InvalidEditorContentError("본문은 JSON 문자열로 보내야 합니다.");
  }
  if (Buffer.byteLength(input, "utf8") > MAX_EDITOR_JSON_BYTES) {
    throw new InvalidEditorContentError("본문이 너무 큽니다.");
  }
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new InvalidEditorContentError("본문 JSON을 읽지 못했습니다.", { cause: error });
  }
}

/** 에디터 JSON → 공개용 본문 HTML. 형식이 잘못되면 InvalidEditorContentError를 던집니다. */
export function editorJsonToHtml(json: unknown) {
  return renderDocToHtml(parseEditorDoc(json));
}

/**
 * 저장용 본문. 스키마로 검사한 문서를 다시 JSON으로 바꿔(doc.toJSON) 저장하므로, 클라이언트가 덧붙인
 * 스키마 밖의 키는 posts.content에 남지 않습니다. content_html은 이 문서로 만듭니다.
 * 형식이 잘못되면 InvalidEditorContentError를 던집니다.
 */
export function prepareEditorContent(json: unknown): {
  json: unknown;
  html: string;
  empty: boolean;
  /** 대체 텍스트가 비어 있는 이미지 수. 발행·예약은 이 값이 0이어야 합니다. */
  missingAlt: number;
} {
  const doc = parseEditorDoc(json);
  return {
    json: doc.toJSON(),
    html: renderDocToHtml(doc),
    empty: !hasContent(doc),
    missingAlt: countMissingAlt(doc),
  };
}

function countMissingAlt(doc: ProseMirrorNode) {
  let count = 0;
  doc.descendants((node) => {
    if (node.type.name === "image" && !String(node.attrs.alt).trim()) count += 1;
  });
  return count;
}

/**
 * 문서에 실제 내용이 있는지. 빈 줄에서 목록·인용만 켜면 HTML에는 `<ul><li></li></ul>`처럼 태그만 남으므로,
 * HTML 문자열이 아니라 문서에서 공백이 아닌 글자나 줄바꿈 외의 인라인 노드(예: 이미지)가 있는지 봅니다.
 */
function hasContent(doc: ProseMirrorNode) {
  let found = false;
  doc.descendants((node) => {
    if (found) return false;
    if (
      node.isText ? (node.text ?? "").trim() !== "" : node.isLeaf && node.type.name !== "hardBreak"
    ) {
      found = true;
    }
    return !found;
  });
  return found;
}

function renderDocToHtml(doc: ProseMirrorNode) {
  const headingIds = assignHeadingIds(doc);

  return renderToHTMLString({
    content: doc,
    extensions,
    options: {
      nodeMapping: {
        paragraph: ({ node, children }) =>
          isBlank(node) ? "" : `<p>${serializeChildrenToHTMLString(children)}</p>`,
        heading: ({ node, children }) => {
          if (isBlank(node)) return "";
          const tag = `h${node.attrs.level}`;
          const attrs = serializeAttrsToHTMLString({ id: headingIds.get(node) });
          return `<${tag}${attrs}>${serializeChildrenToHTMLString(children)}</${tag}>`;
        },
        // 빈 코드 블록·콜아웃도 공개 페이지에 빈 상자로 남지 않게 출력하지 않습니다.
        codeBlock: ({ node, children }) => {
          if (isBlank(node)) return "";
          const attrs = serializeAttrsToHTMLString({
            "data-language": node.attrs.language || null,
            // 공백뿐인 파일명은 없는 것으로 봅니다(공개 머리글이 비지 않도록 언어 이름을 보여 줌).
            "data-filename": node.attrs.filename?.trim() || null,
          });
          return `<pre${attrs}><code>${serializeChildrenToHTMLString(children)}</code></pre>`;
        },
        // 이미지는 figure로 감싸고, 캡션이 있으면 figcaption을 붙입니다. 공개 페이지는 렌더링 단계(render.ts)에서
        // 최적화 주소(srcset)로 바꿉니다. width·height는 자리를 미리 잡는 데 씁니다.
        image: ({ node }) => {
          const { src, width, height, caption } = node.attrs;
          const img = `<img${serializeAttrsToHTMLString({ src, alt: String(node.attrs.alt).trim(), width, height })}>`;
          const figcaption = String(caption).trim()
            ? `<figcaption>${escapeHtml(String(caption).trim())}</figcaption>`
            : "";
          return `<figure>${img}${figcaption}</figure>`;
        },
        callout: ({ node, children }) => {
          if (!node.textContent.trim()) return "";
          const attrs = serializeAttrsToHTMLString({ "data-callout": node.attrs.type });
          return `<aside${attrs}>${serializeChildrenToHTMLString(children)}</aside>`;
        },
      },
    },
  });
}
