"use client";

import { Extension, type Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState, useTransition } from "react";

import { previewPost, type PreviewResult } from "@/app/admin/(panel)/posts/actions";
import { createEditorExtensions } from "@/lib/editor/extensions";

import { EditorSkeleton } from "./editor-skeleton";

/*
 * 관리자 글 에디터 (Tiptap). 관리자 글 작성 페이지만 가져오므로 라우트별 코드 분할로 공개 라우트 번들에는 들어가지 않습니다.
 * next/dynamic을 쓰지 않는 이유는 ADR-0011 "에디터 번들 분리"에 있습니다.
 * 원본은 editor.getJSON()이고, 공개용 HTML은 서버가 이 JSON으로 만듭니다(lib/content/editor-html.ts).
 */

// 에디터는 브라우저에서 만들어진 뒤에만 툴바를 그리므로(immediatelyRender: false), 이 값은 서버 렌더링 결과에 쓰이지 않습니다.
function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/** 단축키는 Mod(맥 ⌘, 그 외 Ctrl) + keys 입니다. Tiptap 기본 단축키와 같은 조합을 씁니다. */
function shortcutLabel(keys: readonly string[]) {
  return isMac()
    ? ["⌘", ...keys.map((key) => (key === "Alt" ? "⌥" : key === "Shift" ? "⇧" : key))].join("")
    : ["Ctrl", ...keys].join("+");
}

function ariaKeyShortcuts(keys: readonly string[]) {
  return [isMac() ? "Meta" : "Control", ...keys].join("+");
}

type Tool = {
  id: string;
  label: string;
  content: React.ReactNode;
  className?: string;
  keys: readonly string[];
  run: (editor: Editor) => void;
};

const BLOCK_TOOLS = [
  {
    id: "paragraph",
    label: "본문",
    content: "본문",
    keys: ["Alt", "0"],
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: "h2",
    label: "소제목 2",
    content: "H2",
    keys: ["Alt", "2"],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "소제목 3",
    content: "H3",
    keys: ["Alt", "3"],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bulletList",
    label: "글머리 목록",
    content: "• 목록",
    keys: ["Shift", "8"],
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "번호 목록",
    content: "1. 목록",
    keys: ["Shift", "7"],
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "blockquote",
    label: "인용",
    content: "인용",
    keys: ["Shift", "B"],
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
] as const satisfies Tool[];

const INLINE_TOOLS = [
  {
    id: "bold",
    label: "굵게",
    content: "B",
    className: "font-bold",
    keys: ["B"],
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: "italic",
    label: "기울임",
    content: "I",
    className: "italic",
    keys: ["I"],
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: "code",
    label: "인라인 코드",
    content: "</>",
    keys: ["E"],
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
] as const satisfies Tool[];

const LINK_KEYS = ["K"] as const;

type ToolId = (typeof BLOCK_TOOLS)[number]["id"] | (typeof INLINE_TOOLS)[number]["id"] | "link";

function selectActive({ editor }: { editor: Editor }): Record<ToolId, boolean> {
  return {
    paragraph: editor.isActive("paragraph") && !editor.isActive("heading"),
    h2: editor.isActive("heading", { level: 2 }),
    h3: editor.isActive("heading", { level: 3 }),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    blockquote: editor.isActive("blockquote"),
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    code: editor.isActive("code"),
    link: editor.isActive("link"),
  };
}

const toolButtonClass =
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-3 font-mono text-meta text-muted hover:bg-surface hover:text-fg aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg";

const modeButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-body text-muted hover:text-fg aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg";

/**
 * 서식 도구 모음. role="toolbar" 패턴을 따라 Tab으로는 한 번만 들어오고, 안에서는 화살표·Home·End로 이동합니다.
 */
function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const active = useEditorState({ editor, selector: selectActive });
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);

  const tools: (Tool | "separator")[] = [
    ...BLOCK_TOOLS,
    "separator",
    ...INLINE_TOOLS,
    {
      id: "link",
      label: "링크",
      content: "링크",
      keys: LINK_KEYS,
      run: onLink,
    },
  ];

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const buttons = buttonsRef.current.filter((button) => button !== null);
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current === -1) return;

    const last = buttons.length - 1;
    const next =
      event.key === "ArrowRight"
        ? current === last
          ? 0
          : current + 1
        : event.key === "ArrowLeft"
          ? current === 0
            ? last
            : current - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;

    event.preventDefault();
    setFocusIndex(next);
    buttons[next].focus();
  }

  let buttonIndex = -1;
  return (
    <div
      role="toolbar"
      aria-label="서식"
      onKeyDown={handleKeyDown}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-bg p-1"
    >
      {tools.map((tool, position) => {
        if (tool === "separator") {
          return (
            <span
              key={`separator-${position}`}
              aria-hidden="true"
              className="mx-1 h-6 w-px bg-border"
            />
          );
        }
        buttonIndex += 1;
        const index = buttonIndex;
        const shortcut = shortcutLabel(tool.keys);
        return (
          <button
            key={tool.id}
            ref={(element) => {
              buttonsRef.current[index] = element;
            }}
            type="button"
            tabIndex={index === focusIndex ? 0 : -1}
            aria-label={tool.label}
            aria-keyshortcuts={ariaKeyShortcuts(tool.keys)}
            aria-pressed={active[tool.id as ToolId]}
            title={`${tool.label} (${shortcut})`}
            onClick={() => {
              setFocusIndex(index);
              tool.run(editor);
            }}
            className={`${toolButtonClass} ${tool.className ?? ""}`}
          >
            {tool.content}
          </button>
        );
      })}
    </div>
  );
}

/** 링크 주소 입력. Enter로 적용, Esc로 닫고 본문으로 돌아갑니다. 주소를 비우고 적용하면 링크를 지웁니다. */
function LinkForm({
  editor,
  initialHref,
  onClose,
}: {
  editor: Editor;
  initialHref: string;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [href, setHref] = useState(initialHref);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function close() {
    onClose();
    editor.commands.focus();
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = href.trim();

    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }

    const chain = editor.chain().focus();
    const applied =
      editor.state.selection.empty && !editor.isActive("link")
        ? // 선택한 글자가 없으면 주소 자체를 링크 글자로 넣습니다.
          chain
            .insertContent({
              type: "text",
              text: value,
              marks: [{ type: "link", attrs: { href: value } }],
            })
            .run()
        : chain.extendMarkRange("link").setLink({ href: value }).run();

    if (!applied) {
      setError("쓸 수 없는 주소입니다. http(s), mailto, 상대 경로, #앵커를 쓸 수 있습니다.");
      inputRef.current?.focus();
      return;
    }
    onClose();
  }

  return (
    <form
      onSubmit={apply}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <label htmlFor="editor-link-href" className="shrink-0 font-mono text-meta text-muted">
          링크 주소
        </label>
        <input
          ref={inputRef}
          id="editor-link-href"
          type="text"
          inputMode="url"
          autoComplete="off"
          value={href}
          onChange={(event) => {
            setHref(event.target.value);
            setError(null);
          }}
          placeholder="https://"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "editor-link-error" : undefined}
          className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-body text-fg placeholder:text-muted"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-fg px-4 text-body font-semibold text-bg hover:bg-fg-secondary"
          >
            적용
          </button>
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border-strong px-4 text-body text-muted hover:text-fg"
          >
            취소
          </button>
        </div>
      </div>
      {error && (
        <p id="editor-link-error" role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function Preview({ result, pending }: { result: PreviewResult | null; pending: boolean }) {
  if (pending || !result) {
    return (
      <p role="status" className="py-10 text-body text-muted">
        미리보기를 만드는 중입니다.
      </p>
    );
  }
  if (!result.ok) {
    return (
      <p role="alert" className="rounded-lg border border-danger px-4 py-3 text-body text-danger">
        {result.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {result.toc.length > 0 && (
        <nav aria-label="미리보기 목차" className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-meta text-muted">{"// on this page"}</p>
          <ol className="mt-2 flex flex-col text-body">
            {result.toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="flex min-h-11 items-center text-muted hover:text-fg"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {result.html ? (
        // 서버의 renderPostHtml이 허용 목록으로 정화한 HTML입니다 (공개 글 상세와 같은 경로).
        <div className="prose-article" dangerouslySetInnerHTML={{ __html: result.html }} />
      ) : (
        <p className="py-10 text-body text-muted">본문이 비어 있습니다.</p>
      )}
    </div>
  );
}

export function PostEditor() {
  const openLinkRef = useRef<() => void>(() => {});
  const previewRequestRef = useRef(0);
  const [link, setLink] = useState<{ href: string } | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const editor = useEditor({
    // 서버 렌더링 결과와 어긋나지 않도록 에디터는 브라우저에서 마운트한 뒤에 만듭니다. 그 전에는 자리 표시를 그립니다.
    immediatelyRender: false,
    extensions: [
      ...createEditorExtensions(),
      // 링크 단축키(Mod-k)는 Tiptap 기본값에 없어 직접 더합니다. 주소 입력 창을 엽니다.
      Extension.create({
        name: "linkShortcut",
        addKeyboardShortcuts() {
          return {
            "Mod-k": () => {
              openLinkRef.current();
              return true;
            },
          };
        },
      }),
    ],
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "본문",
        class: "prose-article min-h-96 px-5 py-6 focus:outline-none md:px-8",
      },
    },
  });

  function openLinkForm() {
    if (!editor) return;
    setLink({ href: editor.getAttributes("link").href ?? "" });
  }

  useEffect(() => {
    openLinkRef.current = openLinkForm;
  });

  if (!editor) return <EditorSkeleton />;

  function showPreview(current: Editor) {
    setMode("preview");
    setLink(null);
    // 미리보기를 연달아 누르면 마지막 요청의 결과만 보여 줍니다.
    const requestId = ++previewRequestRef.current;
    startTransition(async () => {
      const result = await previewPost(current.getJSON());
      if (requestId !== previewRequestRef.current) return;
      // await 뒤의 상태 변경은 다시 startTransition으로 감싸야 같은 전환으로 묶입니다 (React 19).
      startTransition(() => setPreview(result));
    });
  }

  return (
    <div className="flex max-w-article flex-col gap-4">
      <div role="group" aria-label="보기 전환" className="flex gap-1">
        <button
          type="button"
          aria-pressed={mode === "write"}
          onClick={() => {
            setMode("write");
            // 미리보기 영역이 숨겨진 뒤에 본문으로 초점을 옮깁니다.
            requestAnimationFrame(() => editor.commands.focus());
          }}
          className={modeButtonClass}
        >
          작성
        </button>
        <button
          type="button"
          aria-pressed={mode === "preview"}
          onClick={() => showPreview(editor)}
          className={modeButtonClass}
        >
          미리보기
        </button>
      </div>

      <div hidden={mode !== "write"} className="flex flex-col gap-3">
        <Toolbar editor={editor} onLink={openLinkForm} />
        {link && <LinkForm editor={editor} initialHref={link.href} onClose={() => setLink(null)} />}
        <div className="rounded-xl border border-border-strong bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-hover">
          <EditorContent editor={editor} />
        </div>
        <p className="font-mono text-caption text-muted">
          {`굵게 ${shortcutLabel(["B"])} · 기울임 ${shortcutLabel(["I"])} · 코드 ${shortcutLabel(["E"])} · 링크 ${shortcutLabel(LINK_KEYS)} · 줄바꿈 Shift+Enter`}
        </p>
      </div>

      {mode === "preview" && (
        <section aria-label="미리보기" aria-busy={isPending}>
          <Preview result={preview} pending={isPending} />
        </section>
      )}
    </div>
  );
}
