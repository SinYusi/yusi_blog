"use client";

import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { EditorContent, ReactNodeViewRenderer, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState, useTransition } from "react";

import { previewPost, type PreviewResult } from "@/app/admin/(panel)/posts/actions";
import { createEditorExtensions } from "@/lib/editor/extensions";
import { isAllowedLinkHref } from "@/lib/editor/link-policy";
import { IMAGE_CONTENT_TYPES } from "@/lib/editor/image-policy";
import { serializeEditorDoc } from "@/lib/editor/transport";

import { EditorSkeleton } from "./editor-skeleton";
import { CalloutView, CodeBlockView, ImageView } from "./node-views";
import { ImageUploadError, uploadImage, type UploadedImage } from "./image-upload";
import { SlashMenu } from "./slash-menu";
import {
  LINK_KEYS,
  separatorClass,
  TOOLBAR_BUTTONS,
  TOOLBAR_ITEMS,
  toolbarClass,
  toolButtonClass,
  type ToolId,
} from "./toolbar-items";

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

// 툴바 버튼 id → 실행할 명령. 링크는 주소 입력 창을 여는 동작이라 Toolbar에서 따로 연결합니다.
// 명령은 에디터의 현재 선택 영역에 적용됩니다. 에디터로 초점을 옮길지는 호출하는 쪽(포인터/키보드)이 정합니다.
type Chain = ReturnType<Editor["chain"]>;
const COMMANDS: Record<Exclude<ToolId, "link">, (chain: Chain) => Chain> = {
  paragraph: (chain) => chain.setParagraph(),
  h2: (chain) => chain.toggleHeading({ level: 2 }),
  h3: (chain) => chain.toggleHeading({ level: 3 }),
  bulletList: (chain) => chain.toggleBulletList(),
  orderedList: (chain) => chain.toggleOrderedList(),
  blockquote: (chain) => chain.toggleBlockquote(),
  bold: (chain) => chain.toggleBold(),
  italic: (chain) => chain.toggleItalic(),
  code: (chain) => chain.toggleCode(),
};

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

const modeButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-body text-muted hover:text-fg aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg";

/**
 * 서식 도구 모음. role="toolbar" 패턴을 따라 Tab으로는 한 번만 들어오고, 안에서는 화살표·Home·End로 이동합니다.
 */
function Toolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const active = useEditorState({ editor, selector: selectActive });
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);

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

  return (
    <div role="toolbar" aria-label="서식" onKeyDown={handleKeyDown} className={toolbarClass}>
      {TOOLBAR_ITEMS.map((tool, position) => {
        if (tool === "separator") {
          return (
            <span key={`separator-${position}`} aria-hidden="true" className={separatorClass} />
          );
        }
        const index = TOOLBAR_BUTTONS.indexOf(tool);
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
            aria-pressed={active[tool.id]}
            title={`${tool.label} (${shortcut})`}
            // 마우스로 누를 때 초점과 선택 영역이 버튼으로 옮겨 가지 않게 합니다. 그대로 두면 명령 뒤에도
            // 초점이 버튼에 남아, 이어서 입력한 글자가 방금 만든 블록이 아닌 곳에 들어갑니다.
            // 키보드(Tab으로 툴바 진입 → 화살표·Enter)는 mousedown이 없으므로 영향이 없습니다.
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              setFocusIndex(index);
              if (tool.id === "link") {
                onLink();
                return;
              }
              // 키보드(Enter·Space)로 누른 클릭은 detail이 0입니다. 이때는 초점을 버튼에 그대로 두어
              // 화살표로 다음 버튼을 계속 고를 수 있게 하고, 포인터로 누르면 에디터로 초점을 돌려 바로 이어 쓰게 합니다.
              const chain = event.detail === 0 ? editor.chain() : editor.chain().focus();
              COMMANDS[tool.id](chain).run();
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

/**
 * 직접 입력한 주소 정리. 프로토콜 없는 외부 주소(example.com/path)는 https://를 붙입니다.
 * defaultProtocol은 자동 링크·붙여넣기에만 적용되어, 그대로 두면 공개 페이지에서 상대 경로로 해석되기 때문입니다.
 * 프로토콜이 있는 주소, 상대 경로(/, ./, ../), #앵커, ?쿼리는 그대로 둡니다.
 */
function normalizeHref(value: string) {
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || /^(\/|\.\.?\/|#|\?)/.test(value))
    return value;
  return /^[^\s/?#]+\.[^\s/?#]+/.test(value) ? `https://${value}` : value;
}

/**
 * 링크 주소 입력. Enter로 적용, Esc로 닫고 본문으로 돌아갑니다. 주소를 비우고 적용하면 링크를 지웁니다.
 * <form>이 아니라 role="group"으로 둡니다. 에디터는 글 저장 폼 안에 있어, 폼을 중첩하면 '적용'이 글 저장 폼을 제출해
 * 글이 저장(발행 설정이면 발행)되기 때문입니다. 적용 버튼은 type="button"이고 Enter는 입력칸에서 직접 처리합니다.
 */
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

  function apply() {
    const value = normalizeHref(href.trim());

    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }

    // 두 적용 경로 모두 문서를 바꾸기 전에 허용 정책(link-policy.ts, Link 확장과 같은 규칙)을 먼저 통과해야 합니다.
    // javascript:, data: 같은 주소를 그대로 적용하면 렌더링 때 href가 지워져, 알리지 않고 깨진 링크가 됩니다.
    if (!isAllowedLinkHref(value) || !editor.can().setLink({ href: value })) {
      setError("쓸 수 없는 주소입니다. http(s), mailto, 상대 경로, #앵커를 쓸 수 있습니다.");
      inputRef.current?.focus();
      return;
    }

    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // 선택한 글자가 없으면 주소 자체를 링크 글자로 넣습니다.
      chain
        .insertContent({
          type: "text",
          text: value,
          marks: [{ type: "link", attrs: { href: value } }],
        })
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href: value }).run();
    }
    onClose();
  }

  return (
    <div
      role="group"
      aria-label="링크 편집"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
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
          onKeyDown={(event) => {
            // 바깥 글 저장 폼의 암묵적 제출(Enter)로 이어지지 않게 막고 링크만 적용합니다. 한글 조합 중 Enter는 글자 확정입니다.
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.stopPropagation();
            apply();
          }}
          placeholder="https://"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "editor-link-error" : undefined}
          className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-body text-fg placeholder:text-muted"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={apply}
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
    </div>
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

// 브라우저가 형식을 판별하지 못한 파일(type이 빈 문자열)도 받고, 실제 형식은 업로드 때 파일 앞부분으로 확인합니다.
function imageFiles(list: FileList | undefined) {
  return Array.from(list ?? []).filter(
    (file) => file.type === "" || file.type.startsWith("image/"),
  );
}

/**
 * 끝난 업로드의 자리 표시를 실제 이미지로 바꾸거나(성공) 지웁니다(실패). 실행 취소 기록에는 넣지 않습니다.
 * 기록에 넣으면 ⌘Z가 '자리 표시 → 실제 이미지' 교체만 되돌려 이미 폐기한 미리보기 주소로 돌아가므로,
 * 실행 취소는 처음 이미지를 넣은 일 자체를 되돌리게 합니다. 업로드 중에 입력한 대체 텍스트·캡션은 유지합니다.
 */
function settleUploads(editor: Editor, results: Map<string, UploadedImage | null>) {
  if (results.size === 0) return;
  const { tr } = editor.state;
  editor.state.doc.descendants((node, pos) => {
    const id = node.type.name === "image" ? node.attrs.uploadId : null;
    if (!id || !results.has(id)) return;
    const result = results.get(id);
    const at = tr.mapping.map(pos);
    if (result) tr.setNodeMarkup(at, undefined, { ...node.attrs, ...result, uploadId: null });
    else tr.delete(at, at + node.nodeSize);
  });
  if (tr.docChanged) editor.view.dispatch(tr.setMeta("addToHistory", false));
}

const editorAttributes = {
  role: "textbox",
  "aria-multiline": "true",
  "aria-label": "본문",
  class: "prose-article min-h-96 px-5 py-6 focus:outline-none md:px-8",
};

export function PostEditor({
  initialContent,
  onEditorChange,
  onUploadingChange,
  errorId,
}: {
  /** 편집할 글의 에디터 원본. 없으면 빈 문서로 시작합니다. */
  initialContent?: JSONContent | null;
  /** 에디터가 만들어지거나 사라질 때 알립니다. 글 저장 폼이 저장할 때 editor.getJSON()을 읽는 데 씁니다. */
  onEditorChange?: (editor: Editor | null) => void;
  /** 이미지 업로드가 시작·끝날 때 알립니다. 업로드 중에 저장하면 이미지가 빠지므로 글 저장 폼이 저장을 막는 데 씁니다. */
  onUploadingChange?: (uploading: boolean) => void;
  /** 본문 오류 메시지의 id. 있으면 본문 입력 영역을 aria-invalid로 표시하고 메시지와 연결합니다. */
  errorId?: string;
} = {}) {
  const openLinkRef = useRef<() => void>(() => {});
  const slashKeyRef = useRef<(key: string) => boolean>(() => false);
  const insertImagesRef = useRef<(files: File[], pos?: number) => void>(() => {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 진행 중인 업로드 묶음 수. 붙여넣기를 여러 번 하면 업로드가 겹치므로, 마지막 업로드가 끝날 때만 '끝남'을 알립니다.
  const activeUploadsRef = useRef(0);
  // 겹친 업로드들의 실패 사유를 모았다가 마지막 업로드가 끝날 때 한꺼번에 알립니다(나중 성공이 앞의 실패를 덮지 않게).
  const uploadFailuresRef = useRef<string[]>([]);
  // 끝난 업로드의 결과(uploadId → 실제 주소·크기, 실패면 null). 다시 실행으로 되살아난 자리 표시도 이 결과로 바꿉니다.
  const uploadResultsRef = useRef(new Map<string, UploadedImage | null>());
  const [imageStatus, setImageStatus] = useState<string | null>(null);
  const previewRequestRef = useRef(0);
  const [link, setLink] = useState<{ href: string } | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const editor = useEditor({
    // 서버 렌더링 결과와 어긋나지 않도록 에디터는 브라우저에서 마운트한 뒤에 만듭니다. 그 전에는 자리 표시를 그립니다.
    immediatelyRender: false,
    extensions: [
      ...createEditorExtensions({
        codeBlock: ReactNodeViewRenderer(CodeBlockView),
        callout: ReactNodeViewRenderer(CalloutView),
        image: ReactNodeViewRenderer(ImageView),
      }),
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
      // 슬래시 메뉴가 열려 있을 때는 화살표·Enter·Esc를 메뉴가 먼저 받습니다(기본 Enter보다 앞서도록 우선순위를 높임).
      Extension.create({
        name: "slashMenuKeys",
        priority: 1000,
        addKeyboardShortcuts() {
          return {
            ArrowDown: () => slashKeyRef.current("ArrowDown"),
            ArrowUp: () => slashKeyRef.current("ArrowUp"),
            Enter: () => slashKeyRef.current("Enter"),
            Escape: () => slashKeyRef.current("Escape"),
          };
        },
      }),
    ],
    // 처음 만들 때만 읽습니다. 저장한 뒤 다시 그려져도 쓰고 있던 문서를 덮어쓰지 않습니다.
    content: initialContent ?? undefined,
    // 본문 오류가 있으면 입력 영역(contenteditable)을 aria-invalid로 표시하고 메시지와 연결합니다.
    // useEditor는 렌더링마다 바뀐 옵션을 setOptions로 반영하므로 오류가 생기고 사라질 때도 따라 바뀝니다.
    editorProps: {
      attributes: errorId
        ? { ...editorAttributes, "aria-invalid": "true", "aria-describedby": errorId }
        : editorAttributes,
      // 이미지 파일을 붙여넣거나 끌어 놓으면 저장소에 올린 뒤 그 자리에 넣습니다(글자·HTML 붙여넣기는 그대로).
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        insertImagesRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (moved || files.length === 0) return false;
        event.preventDefault();
        insertImagesRef.current(
          files,
          view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos,
        );
        return true;
      },
    },
  });

  useEffect(() => {
    onEditorChange?.(editor);
    return () => onEditorChange?.(null);
  }, [editor, onEditorChange]);

  function openLinkForm() {
    if (!editor) return;
    setLink({ href: editor.getAttributes("link").href ?? "" });
  }

  useEffect(() => {
    openLinkRef.current = openLinkForm;
  });

  /**
   * 이미지 넣기. 붙여넣거나 끌어 놓는 순간 자리 표시(미리보기 주소 + uploadId)를 그 자리에 넣고,
   * 하나씩 업로드가 끝나면 그 노드를 찾아 실제 주소·크기로 바꿉니다. 자리를 먼저 차지하므로 업로드 중에
   * 글을 더 쓰거나 다른 이미지를 겹쳐 넣어도 붙여넣은 순서와 위치가 그대로 유지됩니다.
   * 넣을 수 없는 자리(콜아웃 안 등)면 올리지 않고 알립니다. 업로드에 실패한 이미지는 자리 표시를 지웁니다.
   */
  async function insertImages(files: File[], startPos?: number) {
    if (!editor) return;
    const findImage = (uploadId: string) => {
      let found: { pos: number; attrs: Record<string, unknown> } | null = null;
      editor.state.doc.descendants((node, nodePos) => {
        if (found) return false;
        if (node.type.name === "image" && node.attrs.uploadId === uploadId) {
          found = { pos: nodePos, attrs: node.attrs };
        }
      });
      return found as { pos: number; attrs: Record<string, unknown> } | null;
    };

    // 1. 자리 표시를 순서대로 넣습니다. 다음 이미지는 바로 앞 이미지 뒤에 들어갑니다.
    let pos = startPos ?? editor.state.selection.from;
    const pending: { file: File; uploadId: string; preview: string }[] = [];
    for (const file of files) {
      const uploadId = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      const node = { type: "image", attrs: { src: preview, uploadId, alt: "", caption: "" } };
      // 빈 문단(예: /이미지를 고른 자리)이면 그 문단을 이미지로 바꾸고, 아니면 그 위치에 넣습니다.
      const $pos = editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
      const target =
        $pos.parent.isTextblock && $pos.parent.content.size === 0 && $pos.depth > 0
          ? { from: $pos.before(), to: $pos.after() }
          : $pos.pos;
      editor.chain().insertContentAt(target, node, { updateSelection: false }).run();
      const placed = findImage(uploadId);
      if (!placed) {
        // 콜아웃 안처럼 규칙에 어긋나는 자리는 에디터가 변경을 적용하지 않습니다(extensions.ts).
        URL.revokeObjectURL(preview);
        setImageStatus("이 자리에는 이미지를 넣을 수 없습니다. 콜아웃 밖에 넣어 주세요.");
        break;
      }
      pos = placed.pos + (editor.state.doc.nodeAt(placed.pos)?.nodeSize ?? 1);
      pending.push({ file, uploadId, preview });
    }
    if (pending.length === 0) return;
    // 보통 붙여넣기처럼 커서를 마지막 이미지 뒤(다음 문단 처음)로 옮겨, 이어 쓰거나 다시 붙여넣으면 그 뒤에 들어가게 합니다.
    // 초점은 옮기지 않고, 업로드가 끝나 노드를 바꿀 때도 커서·초점을 건드리지 않습니다.
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos))),
    );

    // 2. 하나씩 올리고 자리 표시를 바꿉니다. 업로드가 겹치면 마지막이 끝날 때만 '끝남'을 알립니다.
    activeUploadsRef.current += 1;
    if (activeUploadsRef.current === 1) onUploadingChange?.(true);
    try {
      for (const [index, { file, uploadId, preview }] of pending.entries()) {
        setImageStatus(`이미지를 올리는 중입니다 (${index + 1}/${pending.length})`);
        let uploaded: Awaited<ReturnType<typeof uploadImage>> | null = null;
        try {
          uploaded = await uploadImage(file);
        } catch (error) {
          uploadFailuresRef.current.push(
            error instanceof ImageUploadError ? error.message : "이미지를 올리지 못했습니다.",
          );
        }
        // 결과를 기록하고 자리 표시를 바꿉니다. 그사이 지운 자리 표시는 건너뛰지만(올린 파일은 저장소에 남음, ADR-0010),
        // 나중에 다시 실행(⌘⇧Z)으로 돌아와도 아래 'update' 처리기가 같은 결과로 바꿉니다.
        uploadResultsRef.current.set(uploadId, uploaded);
        settleUploads(editor, uploadResultsRef.current);
        URL.revokeObjectURL(preview);
      }
    } finally {
      activeUploadsRef.current -= 1;
      if (activeUploadsRef.current === 0) {
        onUploadingChange?.(false);
        const failures = uploadFailuresRef.current;
        uploadFailuresRef.current = [];
        setImageStatus(
          failures.length > 0
            ? `이미지 ${failures.length}개를 올리지 못해 본문에서 뺐습니다. ${failures[0]}`
            : "이미지를 넣었습니다. 이미지 아래에 대체 텍스트를 입력하세요.",
        );
      }
    }
  }

  useEffect(() => {
    insertImagesRef.current = (files, pos) => void insertImages(files, pos);
  });

  // 실행 취소·다시 실행으로 끝난 업로드의 자리 표시가 다시 나타나면 기록한 결과로 바로 바꿉니다.
  useEffect(() => {
    if (!editor) return;
    const results = uploadResultsRef.current;
    const settle = () => settleUploads(editor, results);
    editor.on("update", settle);
    return () => {
      editor.off("update", settle);
    };
  }, [editor]);

  if (!editor) return <EditorSkeleton />;

  function showPreview(current: Editor) {
    setMode("preview");
    setLink(null);
    // 미리보기를 연달아 누르면 마지막 요청의 결과만 보여 줍니다.
    const requestId = ++previewRequestRef.current;
    startTransition(async () => {
      let result: PreviewResult;
      try {
        result = await previewPost(serializeEditorDoc(current.getJSON()));
      } catch {
        // 네트워크 오류나 서버 오류로 실패해도 로딩을 끝내고, 이전 결과 대신 오류를 보여 줍니다.
        result = {
          ok: false,
          message: "미리보기를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
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
        <div className="relative rounded-xl border border-border-strong bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-hover">
          <EditorContent editor={editor} />
          <SlashMenu
            editor={editor}
            keyRef={slashKeyRef}
            onImage={() => fileInputRef.current?.click()}
          />
        </div>
        <p className="font-mono text-caption text-muted">
          {`블록 넣기 / · 이미지 붙여넣기·끌어 놓기 · 굵게 ${shortcutLabel(["B"])} · 기울임 ${shortcutLabel(["I"])} · 코드 ${shortcutLabel(["E"])} · 링크 ${shortcutLabel(LINK_KEYS)} · 줄바꿈 Shift+Enter`}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_CONTENT_TYPES.join(",")}
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void insertImages(files);
          }}
        />
        <p role="status" className="text-meta text-muted">
          {imageStatus}
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
