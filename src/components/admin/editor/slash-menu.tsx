"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useState, type RefObject } from "react";

import { LOG_LANGUAGE } from "@/lib/content/code-languages";
import { CALLOUT_ALLOWED_BLOCKS, CALLOUT_TYPES } from "@/lib/editor/extensions";

import { CALLOUT_LABELS } from "./node-views";

/*
 * 슬래시 커맨드 메뉴. 빈 문단에서 /를 입력하면 블록 목록을 띄우고, 이어 쓴 글자로 거릅니다(/코드, /callout).
 * combobox 패턴: 초점은 본문(contenteditable)에 그대로 두고 aria-activedescendant로 고른 항목을 알립니다.
 * 화살표로 고르고 Enter로 넣고, Esc로 닫습니다. 키 처리는 에디터 확장(post-editor.tsx)이 keyRef로 넘겨줍니다.
 */

type Chain = ReturnType<Editor["chain"]>;
type SlashItem = {
  id: string;
  label: string;
  keywords: string;
  run: (chain: Chain) => Chain;
  /** 만드는 블록 종류. 콜아웃 안(목록 속 포함)에서 쓸 수 없는 블록을 거르는 데 씁니다. */
  node: string;
};

const ITEMS: SlashItem[] = [
  {
    // 파일 선택 창을 엽니다(SlashMenu의 onImage). 선택한 이미지는 지금 문단 자리에 들어갑니다.
    id: "image",
    label: "이미지",
    keywords: "image img picture photo 사진",
    run: (c) => c,
    node: "image",
  },
  {
    id: "h2",
    label: "소제목 2",
    keywords: "h2 heading",
    run: (c) => c.setHeading({ level: 2 }),
    node: "heading",
  },
  {
    id: "h3",
    label: "소제목 3",
    keywords: "h3 heading",
    run: (c) => c.setHeading({ level: 3 }),
    node: "heading",
  },
  {
    id: "bullet",
    label: "글머리 목록",
    keywords: "ul bullet list",
    run: (c) => c.toggleBulletList(),
    node: "bulletList",
  },
  {
    id: "ordered",
    label: "번호 목록",
    keywords: "ol ordered list",
    run: (c) => c.toggleOrderedList(),
    node: "orderedList",
  },
  {
    id: "quote",
    label: "인용",
    keywords: "quote blockquote",
    run: (c) => c.setBlockquote(),
    node: "blockquote",
  },
  {
    id: "code",
    label: "코드 블록",
    keywords: "code pre",
    run: (c) => c.setCodeBlock(),
    node: "codeBlock",
  },
  {
    id: "log",
    label: "로그",
    keywords: "log output terminal",
    run: (c) => c.setCodeBlock({ language: LOG_LANGUAGE }),
    node: "codeBlock",
  },
  ...CALLOUT_TYPES.map((type) => ({
    id: `callout-${type}`,
    label: `콜아웃 · ${CALLOUT_LABELS[type]}`,
    keywords: `${type} callout`,
    // toggleWrap은 같은 종류의 콜아웃 안에서 쓰면 콜아웃을 풀어 버리므로, 감싸기만 하는 wrapIn을 씁니다.
    run: (c: Chain) => c.wrapIn("callout", { type }),
    node: "callout",
  })),
];

function matches(item: SlashItem, query: string) {
  const q = query.toLowerCase();
  return item.label.replaceAll(" ", "").toLowerCase().includes(q) || item.keywords.includes(q);
}

/** 커서가 '/검색어'만 있는 문단 끝에 있으면 그 위치와 검색어. 아니면 null. */
function selectSlash({ editor }: { editor: Editor }) {
  const { empty, $from } = editor.state.selection;
  const parent = $from.parent;
  if (!editor.isFocused || !empty || parent.type.name !== "paragraph") return null;
  if ($from.parentOffset !== parent.content.size || parent.childCount !== 1) return null;
  const text = parent.textContent;
  if (!/^\/\S*$/.test(text)) return null;
  // 메뉴 위치: 본문 입력 영역 기준 좌표. 에디터가 상태를 바꾼 직후(트랜잭션 뒤)에 읽으므로 방금 바뀐 문서 기준입니다.
  const caret = editor.view.coordsAtPos($from.start());
  const box = editor.view.dom.getBoundingClientRect();
  return {
    from: $from.start(),
    to: $from.pos,
    query: text.slice(1),
    inCallout: Array.from({ length: $from.depth }, (_, d) => $from.node(d + 1)).some(
      (node) => node.type.name === "callout",
    ),
    top: caret.bottom - box.top,
    left: caret.left - box.left,
  };
}

export const SLASH_MENU_ID = "editor-slash-menu";

export function SlashMenu({
  editor,
  keyRef,
  onImage,
}: {
  editor: Editor;
  /** "이미지" 항목을 고르면 부릅니다. 파일 선택 창을 여는 일은 에디터가 맡습니다. */
  onImage: () => void;
  /** 에디터 키 처리기에 넘겨줄 함수. 메뉴가 키를 처리했으면 true를 돌려줍니다. */
  keyRef: RefObject<(key: string) => boolean>;
}) {
  const slash = useEditorState({ editor, selector: selectSlash });
  const [selected, setSelected] = useState({ query: "", index: 0 });
  const [dismissedFrom, setDismissedFrom] = useState<number | null>(null);

  // '/'를 지우면 Esc로 닫은 기록도 지웁니다. 같은 자리에서 다시 /를 쓰면 메뉴가 다시 열립니다.
  if (!slash && dismissedFrom !== null) setDismissedFrom(null);

  const items =
    slash && slash.from !== dismissedFrom
      ? ITEMS.filter(
          (item) =>
            matches(item, slash.query) &&
            // 콜아웃 안에서는 허용 목록 밖의 블록을 뺍니다. 에디터도 그런 변경은 적용하지 않지만(extensions.ts),
            // can()은 그 검사를 거치지 않으므로 메뉴에서 미리 거릅니다.
            !(slash.inCallout && !CALLOUT_ALLOWED_BLOCKS.includes(item.node)) &&
            // 그 밖에 스키마상 들어갈 수 없는 자리도 뺍니다.
            item.run(editor.can().chain().deleteRange({ from: slash.from, to: slash.to })).run(),
        )
      : [];
  const open = slash !== null && items.length > 0;
  const index =
    slash && selected.query === slash.query ? Math.min(selected.index, items.length - 1) : 0;
  const activeId = open ? `${SLASH_MENU_ID}-${items[index].id}` : null;

  function choose(item: SlashItem) {
    if (!slash) return;
    item.run(editor.chain().focus().deleteRange({ from: slash.from, to: slash.to })).run();
    if (item.id === "image") onImage();
  }

  useEffect(() => {
    keyRef.current = (key) => {
      if (!open || !slash) return false;
      if (key === "ArrowDown" || key === "ArrowUp") {
        const step = key === "ArrowDown" ? 1 : -1;
        setSelected({ query: slash.query, index: (index + step + items.length) % items.length });
      } else if (key === "Enter") {
        choose(items[index]);
      } else if (key === "Escape") {
        setDismissedFrom(slash.from);
      } else {
        return false;
      }
      return true;
    };
  });

  // 본문 입력 영역(ProseMirror가 관리하는 요소)에 메뉴와의 연결을 직접 답니다.
  // editorProps.attributes로 넘기면 메뉴 상태가 바뀔 때마다 에디터 옵션 전체를 다시 설정하게 됩니다.
  useEffect(() => {
    const dom = editor.view.dom;
    if (!activeId) return;
    dom.setAttribute("aria-controls", SLASH_MENU_ID);
    dom.setAttribute("aria-activedescendant", activeId);
    dom.setAttribute("aria-autocomplete", "list");
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
    return () => {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
      dom.removeAttribute("aria-autocomplete");
    };
  }, [editor, activeId]);

  // 메뉴가 열려 있는 동안만 본문을 펼쳐진 combobox로 알립니다(aria-expanded는 textbox 역할에 쓸 수 없음). 닫히면 원래 역할로 돌립니다.
  useEffect(() => {
    const dom = editor.view.dom;
    if (!open) return;
    const previousRole = dom.getAttribute("role");
    dom.setAttribute("role", "combobox");
    dom.setAttribute("aria-expanded", "true");
    return () => {
      if (previousRole === null) dom.removeAttribute("role");
      else dom.setAttribute("role", previousRole);
      dom.removeAttribute("aria-expanded");
    };
  }, [editor, open]);

  if (!open) return null;

  return (
    <ul
      id={SLASH_MENU_ID}
      role="listbox"
      aria-label="블록 넣기"
      // 본문 입력 영역과 같은 기준(relative 상자)에 놓습니다. 상자 테두리(1px)만큼의 차이는 무시합니다.
      style={{ top: slash.top, left: slash.left }}
      className="absolute z-20 mt-1 flex max-h-80 w-64 flex-col overflow-y-auto rounded-xl border border-border-strong bg-bg p-1"
    >
      {items.map((item, position) => (
        <li
          key={item.id}
          id={`${SLASH_MENU_ID}-${item.id}`}
          role="option"
          aria-selected={position === index}
          // 누를 때 본문에서 초점이 빠지면 메뉴가 닫히므로 초점 이동을 막습니다.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setSelected({ query: slash.query, index: position })}
          onClick={() => choose(item)}
          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-body text-fg-secondary aria-selected:bg-surface aria-selected:text-fg"
        >
          {item.label}
          <span className="font-mono text-caption text-muted">{item.keywords.split(" ")[0]}</span>
        </li>
      ))}
    </ul>
  );
}
