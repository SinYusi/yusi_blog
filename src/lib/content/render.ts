import "server-only";

import type { Element, ElementContent, Root } from "hast";
import { toString } from "hast-util-to-string";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { getImageProps } from "next/image";
import { createHighlighter } from "shiki";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { isAllowedImageSrc, isImageDimension } from "@/lib/editor/image-policy";

import { LOG_LANGUAGE, resolveLanguage, SUPPORTED_LANGUAGES } from "./code-languages";

/*
 * 저장된 본문 HTML(content_html)을 공개 페이지용 HTML로 바꿉니다. 빌드 시 'use cache' 안에서 한 번 실행되므로
 * 하이라이트·정화 비용이 방문자에게 가지 않고, 클라이언트로 JS도 보내지 않습니다.
 *
 * 1. 정화: 허용한 태그·속성만 남깁니다 (seed-data.ts 상단의 본문 HTML 규칙).
 * 2. 코드 블록: <pre data-language data-filename>을 Shiki로 하이라이트하고 파일명·복사 버튼 머리글을 붙입니다.
 * 3. 표: 좁은 화면에서 가로 스크롤되도록 감쌉니다.
 * 3-1. 이미지: next/image의 최적화 주소(srcset)로 바꿉니다(ADR-0010).
 * 4. 목차: id가 있는 h2를 모읍니다.
 */

export type TocItem = { id: string; text: string };

/*
 * GitHub 라이트 테마의 주석 색(#6e7781)은 흰 배경 기준이라, 코드 배경 토큰(--code #eef2f8) 위에서 4.05:1로
 * WCAG AA(4.5:1)에 못 미칩니다. 대비 검사(check:contrast)를 거친 muted 토큰으로 바꿉니다.
 * 값 대신 CSS 변수를 넣어, 토큰을 바꾸면 코드 주석 색도 함께 바뀌게 합니다.
 */
const COLOR_REPLACEMENTS = { "github-light-default": { "#6e7781": "var(--muted)" } };

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined;
function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ["github-light-default", "github-dark-default"],
    langs: [...SUPPORTED_LANGUAGES],
  });
  return highlighterPromise;
}

const HEADING_ID_PREFIX = "sec-";

// 기본 허용 목록에 본문 규칙이 쓰는 속성만 더합니다. 스크립트, 이벤트 속성, iframe 등은 제거됩니다.
const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  // 본문 id가 레이아웃의 id(예: main)와 겹치지 않도록 고정 접두사를 붙입니다. 목차는 정화된 id로 만듭니다.
  clobberPrefix: HEADING_ID_PREFIX,
  tagNames: [...(defaultSchema.tagNames ?? []), "aside", "figure", "figcaption"],
  attributes: {
    ...defaultSchema.attributes,
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "dataLanguage", "dataFilename"],
    aside: [["dataCallout", "info", "warning", "danger"]],
    img: [...(defaultSchema.attributes?.img ?? []), "alt", "width", "height"],
  },
};

const h = (
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[] = [],
): Element => ({
  type: "element",
  tagName,
  properties,
  children,
});
const text = (value: string): ElementContent => ({ type: "text", value });

function rehypeCodeBlocks(highlighter: Awaited<ReturnType<typeof createHighlighter>>) {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || index === undefined || !parent) return;

      const rawLanguage = node.properties.dataLanguage;
      const filename = node.properties.dataFilename ? String(node.properties.dataFilename) : null;
      const code = toString(node).replace(/\n$/, "");
      const lang = resolveLanguage(rawLanguage);
      const isLog = String(rawLanguage) === LOG_LANGUAGE;

      const pre = lang
        ? (highlighter.codeToHast(code, {
            lang,
            themes: { light: "github-light-default", dark: "github-dark-default" },
            defaultColor: false,
            colorReplacements: COLOR_REPLACEMENTS,
          }).children[0] as Element)
        : h("pre", { className: ["shiki"] }, [h("code", {}, [text(code)])]);
      pre.properties.tabIndex = 0; // 가로 스크롤을 키보드로도 할 수 있게 합니다.

      const label = filename ?? (isLog ? "log" : (lang ?? "text"));
      const figure = h("figure", { className: ["code-block"], dataKind: isLog ? "log" : "code" }, [
        h("figcaption", {}, [
          h("span", {}, [text(label)]),
          h("button", { type: "button", dataCopyCode: "", ariaLabel: `${label} 코드 복사` }, [
            text("copy"),
          ]),
        ]),
        pre,
      ]);

      parent.children[index] = figure;
      return "skip";
    });
  };
}

/** 본문 너비(--container-article 42.5rem = 680px)에 맞춘 sizes. 좁은 화면에서는 화면 너비만큼 */
const IMAGE_SIZES = "(min-width: 768px) 680px, 100vw";

/*
 * 본문은 HTML 문자열로 넣으므로 <Image> 컴포넌트를 쓸 수 없어, getImageProps로 같은 속성을 만들어 바꿉니다.
 * 원본 width·height는 그대로 두어 자리를 미리 잡고(레이아웃 이동 없음), 첫 이미지만 바로 불러옵니다.
 * 저장소 밖 주소나 크기 정보가 없는 이미지는 최적화할 수 없으므로 지웁니다(에디터 검사를 우회한 경우).
 */
function rehypeImages() {
  return (tree: Root) => {
    let first = true;
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "img" || index === undefined || !parent) return;
      const { src, alt } = node.properties;
      const width = Number(node.properties.width);
      const height = Number(node.properties.height);
      if (!isAllowedImageSrc(src) || !isImageDimension(width) || !isImageDimension(height)) {
        parent.children.splice(index, 1);
        return index;
      }
      const { props } = getImageProps({
        src,
        alt: typeof alt === "string" ? alt : "",
        width,
        height,
        sizes: IMAGE_SIZES,
        quality: 75,
        loading: first ? "eager" : "lazy",
      });
      first = false;
      node.properties = {
        src: props.src,
        srcSet: props.srcSet,
        sizes: props.sizes,
        alt: props.alt,
        width: props.width,
        height: props.height,
        loading: props.loading,
        decoding: props.decoding,
      };
    });
  };
}

function rehypeTableScroll() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || index === undefined || !parent) return;
      parent.children[index] = h(
        "div",
        { className: ["table-scroll"], tabIndex: 0, role: "region", ariaLabel: "표" },
        [node],
      );
      return "skip";
    });
  };
}

/*
 * 본문 안의 #앵커 링크도 접두사가 붙은 id를 가리키게 합니다. 정화 단계는 원본 id가 이미 접두사로 시작해도
 * 항상 접두사를 붙이므로 링크에도 항상 붙입니다. 조각은 디코딩하지 않고 그대로 둡니다. 브라우저가 이동할 때
 * 디코딩해 id와 비교하므로, 잘못된 %-인코딩이 있어도 렌더링이 실패하지 않습니다.
 */
function rehypePrefixHashLinks() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      const href = node.properties.href;
      if (
        node.tagName === "a" &&
        typeof href === "string" &&
        href.length > 1 &&
        href.startsWith("#")
      ) {
        node.properties.href = `#${HEADING_ID_PREFIX}${href.slice(1)}`;
      }
    });
  };
}

function collectToc(tree: Root) {
  const toc: TocItem[] = [];
  visit(tree, "element", (node) => {
    if (node.tagName === "h2" && typeof node.properties.id === "string") {
      toc.push({ id: node.properties.id, text: toString(node) });
    }
  });
  return toc;
}

export async function renderPostHtml(contentHtml: string) {
  const highlighter = await getHighlighter();
  let toc: TocItem[] = [];

  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypePrefixHashLinks)
    .use(() => (tree: Root) => {
      toc = collectToc(tree);
    })
    .use(() => rehypeCodeBlocks(highlighter))
    .use(rehypeTableScroll)
    .use(rehypeImages)
    .use(rehypeStringify)
    .process(contentHtml);

  return { html: String(file), toc };
}
