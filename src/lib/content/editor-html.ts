import "server-only";

import { getSchema } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  renderToHTMLString,
  serializeAttrsToHTMLString,
  serializeChildrenToHTMLString,
} from "@tiptap/static-renderer/pm/html-string";

import { createEditorExtensions, HEADING_LEVELS } from "@/lib/editor/extensions";

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
// 빈 소제목은 목차에 빈 항목을 만들기 때문입니다.
function isBlank(node: ProseMirrorNode) {
  return node.textContent.trim() === "" && !node.firstChild?.isLeaf;
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
    if (
      node.type.name === "heading" &&
      !(HEADING_LEVELS as readonly unknown[]).includes(node.attrs.level)
    ) {
      throw new InvalidEditorContentError(`지원하지 않는 소제목 단계입니다: ${node.attrs.level}`);
    }
  });
  return doc;
}

/** 에디터 JSON → 공개용 본문 HTML. 형식이 잘못되면 InvalidEditorContentError를 던집니다. */
export function editorJsonToHtml(json: unknown) {
  const doc = parseEditorDoc(json);
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
      },
    },
  });
}
