"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";

import {
  createPostAction,
  updatePostAction,
  type PostFormState,
} from "@/app/admin/(panel)/posts/actions";
import { PostEditor } from "@/components/admin/editor/post-editor";
import {
  readPostForm,
  SERIES_ORDER_MAX,
  SLUG_MAX,
  SLUG_PATTERN_HTML,
  SUMMARY_MAX,
  TITLE_MAX,
  normalizeTagName,
  validatePostInput,
  type FieldErrors,
  type PostField,
  type PublishMode,
} from "@/lib/admin/post-input";
import type { PostFormOptions } from "@/lib/admin/posts";
import { serializeEditorDoc } from "@/lib/editor/transport";
import { formatDateTime } from "@/lib/format";

import { errorClass, fieldClass, hintClass, labelClass, primaryButtonClass } from "./styles";
import { TagInput } from "./tag-input";

/*
 * 글 작성·수정 폼. 저장은 서버 액션(posts/actions.ts)이 하고, 여기서는 입력을 모아 보내고 결과를 그립니다.
 * - 본문은 에디터 문서를 JSON 문자열로 바꿔 FormData에 넣습니다. 객체를 그대로 보내면 안 되는 이유는 lib/editor/transport.ts.
 * - <form action>을 쓰면 React가 제출 뒤 폼을 초기화하므로, onSubmit에서 FormData를 만들어 액션을 부릅니다.
 *   그래서 저장에 실패해도 입력한 내용이 그대로 남습니다.
 * - 같은 검증 함수(validatePostInput)를 저장 전에 먼저 돌려 형식 오류는 서버에 가지 않고 바로 알립니다. 서버도 다시 검사합니다.
 * - 자동 저장과 동시 편집 충돌 방지는 ADR-0014: 저장된 초안만 입력이 멈추면 자동 저장하고, 모든 저장은 불러온
 *   updated_at(baseUpdatedAt)을 함께 보내 다른 탭이 먼저 저장했으면 서버가 덮어쓰지 않습니다.
 */

/** 입력이 멈춘 뒤 자동 저장까지 기다리는 시간 */
const AUTOSAVE_DELAY_MS = 2000;

type AutosaveState =
  | { status: "idle" }
  | { status: "queued" }
  | { status: "saving" }
  | { status: "saved"; message: string; savedAt: string }
  | { status: "blocked" }
  | { status: "failed"; message: string };

export type PostFormInitial = {
  title: string;
  slug: string;
  summary: string;
  tags: string[];
  seriesId: number | null;
  seriesOrder: number | null;
  publishMode: PublishMode;
  /** datetime-local 값 (한국 시간). 예약이 아니면 빈 문자열 */
  scheduledAt: string;
  content: JSONContent | null;
  /** 불러온 글의 updated_at (ISO). 저장할 때 비교 기준으로 보냅니다. 새 글이면 null */
  updatedAt: string | null;
};

const FIELD_LABELS: Record<PostField, string> = {
  title: "제목",
  slug: "주소(slug)",
  summary: "요약",
  tags: "태그",
  seriesId: "시리즈",
  seriesOrder: "시리즈 순번",
  content: "본문",
  publishMode: "발행 설정",
  scheduledAt: "발행 시각",
};

// 오류 요약의 순서를 화면 순서와 맞춥니다.
const FIELD_ORDER: PostField[] = [
  "title",
  "slug",
  "summary",
  "tags",
  "seriesId",
  "seriesOrder",
  "content",
  "publishMode",
  "scheduledAt",
];

const FIELD_IDS: Record<Exclude<PostField, "content">, string> = {
  title: "post-title",
  slug: "post-slug",
  summary: "post-summary",
  tags: "post-tags",
  seriesId: "post-series",
  seriesOrder: "post-series-order",
  publishMode: "post-publish-draft",
  scheduledAt: "post-scheduled-at",
};

const errorId = (field: PostField) => `post-${field}-error`;

function describedBy(...ids: (string | false | null | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

function FieldError({ field, errors }: { field: PostField; errors: FieldErrors }) {
  const message = errors[field];
  if (!message) return null;
  return (
    <p id={errorId(field)} className={errorClass}>
      {message}
    </p>
  );
}

const PUBLISH_OPTIONS: { mode: PublishMode; label: string }[] = [
  { mode: "draft", label: "초안" },
  { mode: "publish", label: "발행" },
  { mode: "schedule", label: "예약" },
];

export function PostForm({
  postId,
  initial,
  options,
  legacyBody,
  publicSlug,
  publishedAtLabel,
  justCreated,
  autosave = false,
}: {
  /** 수정할 글 id. 새 글이면 null */
  postId: number | null;
  initial: PostFormInitial;
  options: PostFormOptions;
  /** 에디터 원본이 없는 글(HTML로만 넣은 시드 글). 본문은 바꾸지 않고 그대로 둡니다. */
  legacyBody: boolean;
  /** 지금 공개 중인 글의 slug. 주소를 바꿀 때 리다이렉트 안내에 씁니다. */
  publicSlug: string | null;
  /** 공개 중인 글의 발행 시각 (표시용) */
  publishedAtLabel: string | null;
  /** 방금 만든 글의 편집 화면이면 true (저장 완료 안내) */
  justCreated: boolean;
  /** 입력이 멈추면 초안으로 자동 저장할지. 저장된 초안만 켭니다(ADR-0014). */
  autosave?: boolean;
}) {
  const action = postId === null ? createPostAction : updatePostAction.bind(null, postId);
  const [serverState, formAction, pending] = useActionState<PostFormState, FormData>(action, {
    status: "idle",
  });
  // 서버에 보내기 전에 찾은 형식 오류. 서버에 보내면 지우고 서버 결과를 보여 줍니다.
  const [localState, setLocalState] = useState<PostFormState | null>(null);
  const state = localState ?? serverState;
  const errors = state.status === "error" ? state.fieldErrors : {};

  const [editor, setEditor] = useState<Editor | null>(null);
  const [slug, setSlug] = useState(initial.slug);
  const [tags, setTags] = useState(initial.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [seriesId, setSeriesId] = useState(initial.seriesId?.toString() ?? "");
  const [seriesOrder, setSeriesOrder] = useState(initial.seriesOrder?.toString() ?? "");
  const [publishMode, setPublishMode] = useState<PublishMode>(initial.publishMode);
  const [scheduledAt, setScheduledAt] = useState(initial.scheduledAt);
  const [createdNotice, setCreatedNotice] = useState(justCreated);
  const summaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 동시 편집 충돌 방지의 비교 기준. 저장할 때마다 서버가 돌려준 새 updated_at으로 바꿉니다.
  const baseUpdatedAtRef = useRef(initial.updatedAt);
  // 저장하지 않은 변경 추적: 변경할 때마다 버전을 올리고, 저장이 끝나면 저장을 시작한 시점의 버전을 저장된 버전으로 둡니다.
  // 저장하는 동안 더 고쳤으면 두 버전이 달라 여전히 저장할 것이 남은 상태가 됩니다.
  const changeVersionRef = useRef(0);
  const submitVersionRef = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [autoState, setAutoState] = useState<AutosaveState>({ status: "idle" });
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runAutosaveRef = useRef<() => void>(() => {});
  // 자동 저장이 띄운 입력 오류. 다음 자동 저장이 검사를 통과하면 이 오류는 지웁니다(직접 저장의 오류는 남김).
  const autosaveErrorRef = useRef<PostFormState | null>(null);
  const conflict = state.status === "error" && state.conflict === true;

  // 방금 만든 글: 안내를 한 번 보여 주고, 새로 고침해도 다시 나오지 않게 주소에서 ?created=1을 지웁니다.
  useEffect(() => {
    if (justCreated) window.history.replaceState(null, "", window.location.pathname);
  }, [justCreated]);

  // 새 오류가 생기면 오류 요약으로 초점을 옮겨, 어떤 칸을 고쳐야 하는지 바로 읽히게 합니다.
  // 다시 저장하는 동안 잠시 보이는 이전 오류로는 초점을 옮기지 않도록, 이미 알린 결과는 건너뜁니다.
  const announcedRef = useRef<PostFormState | null>(null);
  useEffect(() => {
    if (state.status !== "error" || announcedRef.current === state) return;
    announcedRef.current = state;
    summaryRef.current?.focus();
  }, [state]);

  // 직접 저장(useActionState)이 끝나면 비교 기준과 저장된 버전을 갱신합니다.
  useEffect(() => {
    if (serverState.status !== "saved") return;
    baseUpdatedAtRef.current = serverState.updatedAt;
    if (changeVersionRef.current === submitVersionRef.current) setDirty(false);
  }, [serverState]);

  // 저장하지 않은 변경이 있으면 탭을 닫거나 새로 고칠 때 브라우저가 확인을 묻게 합니다.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => () => clearTimeout(autosaveTimerRef.current), []);

  // 공개·예약 글을 초안으로 저장한 뒤 자동 저장이 켜지면, 그 저장 중에 고친 내용(자동 저장이 꺼져 있어 예약되지 않음)을 저장합니다.
  useEffect(() => {
    if (!autosave || !dirty) return;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => runAutosaveRef.current(), AUTOSAVE_DELAY_MS);
  }, [autosave, dirty]);

  const markChanged = useCallback(() => {
    changeVersionRef.current += 1;
    setDirty(true);
    if (!autosave) return;
    // 이전 자동 저장 결과 대신 곧 저장할 변경이 있음을 알립니다. 진행 중인 저장은 그대로 보여 줍니다.
    setAutoState((prev) => (prev.status === "saving" ? prev : { status: "queued" }));
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => runAutosaveRef.current(), AUTOSAVE_DELAY_MS);
  }, [autosave]);

  // 본문 변경은 에디터 이벤트로 받습니다(contenteditable은 폼의 onChange로 오지 않음).
  useEffect(() => {
    if (!editor) return;
    editor.on("update", markChanged);
    return () => {
      editor.off("update", markChanged);
    };
  }, [editor, markChanged]);

  // 저장된 글의 주소를 바꾸는 중인지. 저장하면 refresh()로 initial.slug가 새 주소가 되어 안내가 사라집니다.
  const slugChanged = postId !== null && slug.trim() !== initial.slug;

  const selectedSeries = options.series.find((item) => item.id.toString() === seriesId) ?? null;
  const otherOrders =
    selectedSeries?.orders.filter((item) => postId === null || item.postId !== postId) ?? [];
  const orderTakenBy = otherOrders.find((item) => item.order.toString() === seriesOrder.trim());

  function nextOrder(id: string) {
    const target = options.series.find((item) => item.id.toString() === id);
    const used = target?.orders.filter((item) => item.postId !== postId) ?? [];
    return Math.max(0, ...used.map((item) => item.order)) + 1;
  }

  function focusField(field: PostField) {
    if (field === "content") {
      editor?.commands.focus();
      return;
    }
    const id = field === "publishMode" ? `post-publish-${publishMode}` : FIELD_IDS[field];
    document.getElementById(id)?.focus();
  }

  /** 폼 값으로 저장 요청을 만듭니다. 에디터가 아직 없으면 null입니다. */
  function buildFormData(form: HTMLFormElement, tagNames: string[]) {
    const formData = new FormData(form);
    for (const tag of tagNames) formData.append("tags", tag);
    if (!legacyBody) {
      if (!editor) return null;
      formData.set("content", serializeEditorDoc(editor.getJSON()));
    }
    if (baseUpdatedAtRef.current) formData.set("baseUpdatedAt", baseUpdatedAtRef.current);
    return formData;
  }

  /**
   * 자동 저장. 발행 설정은 바꾸지 않고 초안으로만 저장합니다(발행·예약은 저장 버튼으로만).
   * 쓰고 있는 태그 입력은 아직 확정하지 않은 값이라 넣지 않습니다. 오류는 초점을 옮기지 않고 상태 줄에만 알립니다.
   */
  function showAutosaveError(error: PostFormState) {
    announcedRef.current = error;
    autosaveErrorRef.current = error;
    setLocalState(error);
    setAutoState({ status: "blocked" });
  }

  async function runAutosave() {
    const form = formRef.current;
    if (!autosave || postId === null || conflict || !form) return;
    if (pending || autoState.status === "saving") {
      // 직접 저장이나 앞선 자동 저장이 진행 중이면, 그동안 생긴 변경은 그 저장이 끝난 뒤 다시 시도합니다.
      autosaveTimerRef.current = setTimeout(() => runAutosaveRef.current(), AUTOSAVE_DELAY_MS);
      return;
    }
    const formData = buildFormData(form, tags);
    if (!formData) return;
    // 자동 저장에서 빼는 입력이 있으면 저장 뒤에도 저장하지 않은 변경으로 남깁니다.
    // - 초안이 아닌 발행 설정, 확정하지 않은 태그: 발행·태그 생성은 저장 버튼으로만 합니다.
    // - 주소(slug): 고치는 도중의 값이 저장되면 그 값마다 이전 주소 리다이렉트가 남으므로(ADR-0012) 저장된 주소를 보냅니다.
    const complete =
      formData.get("publishMode") === "draft" &&
      !normalizeTagName(tagDraft) &&
      formData.get("slug") === initial.slug;
    formData.set("publishMode", "draft");
    formData.set("slug", initial.slug);
    formData.delete("scheduledAt");
    const checked = validatePostInput(readPostForm(formData), new Date(), "defer");
    if (!checked.ok) {
      // 직접 저장처럼 칸마다 오류를 보여 주되, 입력하는 중이므로 오류 요약으로 초점을 옮기지는 않습니다(이미 알린 것으로 표시).
      showAutosaveError({
        status: "error",
        message: `자동 저장하지 못했습니다. 아래 ${Object.keys(checked.errors).length}개 항목을 확인하세요.`,
        fieldErrors: checked.errors,
      });
      return;
    }
    if (state === autosaveErrorRef.current) setLocalState(null);

    const version = changeVersionRef.current;
    setAutoState({ status: "saving" });
    let result: PostFormState;
    try {
      result = await updatePostAction(postId, { status: "idle" }, formData);
    } catch {
      setAutoState({ status: "failed", message: "연결을 확인하세요." });
      return;
    }
    if (result.status === "saved") {
      baseUpdatedAtRef.current = result.updatedAt;
      if (changeVersionRef.current === version && complete) setDirty(false);
      // 모든 입력을 저장했으면 앞서 난 입력 오류 표시는 더 이상 맞지 않으므로 지웁니다.
      // 일부만 저장했으면 빠진 입력(예: 예약 시각)의 오류일 수 있어 남겨 둡니다.
      if (complete && state.status === "error") setLocalState({ status: "idle" });
      autosaveErrorRef.current = null;
      setAutoState({
        status: "saved",
        message: complete
          ? "자동 저장했습니다."
          : "주소·발행 설정·입력 중인 태그를 뺀 내용을 자동 저장했습니다. 나머지는 저장 버튼으로 저장하세요.",
        savedAt: result.savedAt,
      });
    } else if (result.status === "error" && result.conflict) {
      // 덮어쓰지 않았음을 오류 요약으로 알리고, 이후 자동 저장을 멈춥니다.
      setAutoState({ status: "idle" });
      setLocalState(result);
    } else if (result.status === "error" && Object.keys(result.fieldErrors).length > 0) {
      // 서버에서만 알 수 있는 입력 오류(주소·시리즈 순번 중복 등)도 같은 방식으로 보여 줍니다.
      showAutosaveError(result);
    } else {
      setAutoState({
        status: "failed",
        message: result.status === "error" ? result.message : "다시 시도하세요.",
      });
    }
  }

  useEffect(() => {
    runAutosaveRef.current = runAutosave;
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || autoState.status === "saving") return;

    // 아직 추가하지 않은 태그 입력도 함께 저장합니다.
    const formData = buildFormData(event.currentTarget, [...tags, tagDraft]);
    if (!formData) return;

    // 기존 글의 지난 예약 시각 검사는 서버가 잠근 행과 비교합니다(저장 뒤 폼 상태와 서버 값이 달라도 맞게 판단).
    const checked = validatePostInput(
      readPostForm(formData),
      new Date(),
      postId === null ? null : "defer",
    );
    if (!checked.ok) {
      setLocalState({
        status: "error",
        message: `저장하지 못했습니다. 아래 ${Object.keys(checked.errors).length}개 항목을 확인하세요.`,
        fieldErrors: checked.errors,
      });
      return;
    }

    // 함께 저장하는 입력 중 태그를 칩으로 옮깁니다. 남겨 두면 다음 저장에서 빠져 연결이 지워집니다.
    const draftName = normalizeTagName(tagDraft);
    if (draftName && !tags.some((tag) => tag.toLowerCase() === draftName.toLowerCase())) {
      const existing = options.tags.find((tag) => tag.toLowerCase() === draftName.toLowerCase());
      setTags([...tags, existing ?? draftName]);
    }
    setTagDraft("");

    setLocalState(null);
    setCreatedNotice(false);
    clearTimeout(autosaveTimerRef.current);
    // 직접 저장이 모든 입력을 저장하므로, 그전의 자동 저장 보류·실패 안내는 지우고 이 저장의 결과를 보여 줍니다.
    setAutoState({ status: "idle" });
    submitVersionRef.current = changeVersionRef.current;
    startTransition(() => formAction(formData));
  }

  const errorEntries = FIELD_ORDER.flatMap((field) =>
    errors[field] ? [[field, errors[field]] as const] : [],
  );
  // 직접 저장과 자동 저장 중 나중에 끝난 결과를 보여 줍니다.
  const lastSaved = [
    serverState.status === "saved" && serverState,
    autoState.status === "saved" && autoState,
  ]
    .filter((item) => item !== false)
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
    .at(-1);
  const statusMessage = pending
    ? "저장하는 중입니다."
    : conflict
      ? "다른 곳에서 먼저 저장해 저장을 멈췄습니다."
      : autoState.status === "saving"
        ? "자동 저장하는 중입니다."
        : autoState.status === "failed"
          ? `자동 저장하지 못했습니다. ${autoState.message}`
          : autoState.status === "blocked"
            ? "입력 오류가 있어 자동 저장하지 않았습니다. 고치면 다시 저장합니다."
            : autoState.status === "queued"
              ? "변경 사항을 곧 자동 저장합니다."
              : dirty && !autosave
                ? "저장하지 않은 변경 사항이 있습니다."
                : lastSaved
                  ? `${lastSaved.message} ${formatDateTime(new Date(lastSaved.savedAt))}`
                  : createdNotice
                    ? "글을 만들었습니다. 이어서 고칠 수 있습니다."
                    : autosave
                      ? "초안은 입력을 멈추면 자동으로 저장합니다."
                      : "";

  const submitLabel = pending
    ? "저장 중…"
    : publishMode === "draft"
      ? "초안 저장"
      : publishMode === "schedule"
        ? "예약 저장"
        : publicSlug
          ? "저장"
          : "발행";

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      // 입력칸·선택·라디오의 변경을 한곳에서 받습니다. 본문과 태그 칩은 따로 알립니다.
      onChange={markChanged}
      onKeyDown={(event) => {
        // 한 줄 입력칸에서 Enter를 눌러 실수로 발행되지 않게 합니다. 저장은 저장 버튼으로만 합니다.
        const target = event.target as HTMLElement;
        if (
          event.key === "Enter" &&
          target instanceof HTMLInputElement &&
          target.type !== "checkbox" &&
          target.type !== "radio"
        ) {
          event.preventDefault();
        }
      }}
      className="flex max-w-article flex-col gap-7"
    >
      {state.status === "error" && (
        <div
          ref={summaryRef}
          id="post-form-error-summary"
          role="alert"
          tabIndex={-1}
          className="flex flex-col gap-2 rounded-lg border border-danger px-4 py-3"
        >
          <p className="text-body font-semibold text-danger">{state.message}</p>
          {errorEntries.length > 0 && (
            <ul className="flex flex-col">
              {errorEntries.map(([field, message]) => (
                <li key={field}>
                  <button
                    type="button"
                    onClick={() => focusField(field)}
                    className="inline-flex min-h-11 cursor-pointer items-center text-left text-meta text-danger underline underline-offset-4"
                  >
                    {FIELD_LABELS[field]}: {message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="post-title" className={labelClass}>
          제목
        </label>
        <input
          id="post-title"
          name="title"
          type="text"
          required
          maxLength={TITLE_MAX}
          defaultValue={initial.title}
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy(errors.title && errorId("title"))}
          className={`${fieldClass} h-auto min-h-11 py-2 text-h3`}
        />
        <FieldError field="title" errors={errors} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="post-slug" className={labelClass}>
          주소(slug)
        </label>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="shrink-0 font-mono text-meta text-muted">
            /posts/
          </span>
          <input
            id="post-slug"
            name="slug"
            type="text"
            required
            maxLength={SLUG_MAX}
            pattern={SLUG_PATTERN_HTML}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={describedBy(
              "post-slug-hint",
              slugChanged && "post-slug-redirect",
              errors.slug && errorId("slug"),
            )}
            className={`${fieldClass} font-mono`}
          />
        </div>
        <p id="post-slug-hint" className={hintClass}>
          영문 소문자, 숫자, 하이픈(-)만 씁니다. 예: nextjs-cache-components
        </p>
        {slugChanged && (
          <p id="post-slug-redirect" className="text-caption text-date">
            {publicSlug
              ? `공개된 글의 주소를 바꾸면 이전 주소(/posts/${initial.slug})로 들어온 방문자는 새 주소로 이동합니다.`
              : `이전 주소(/posts/${initial.slug})는 이 글 몫으로 남겨, 글이 공개 중일 때 새 주소로 이동시킵니다. 다른 글은 쓸 수 없습니다.`}
          </p>
        )}
        <FieldError field="slug" errors={errors} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="post-summary" className={labelClass}>
          요약 <span className="text-caption">(선택)</span>
        </label>
        <textarea
          id="post-summary"
          name="summary"
          rows={3}
          maxLength={SUMMARY_MAX}
          defaultValue={initial.summary}
          aria-invalid={errors.summary ? true : undefined}
          aria-describedby={describedBy("post-summary-hint", errors.summary && errorId("summary"))}
          className={`${fieldClass} h-auto py-2`}
        />
        <p id="post-summary-hint" className={hintClass}>
          글 목록과 검색 결과 설명에 쓰입니다. {SUMMARY_MAX}자 이하.
        </p>
        <FieldError field="summary" errors={errors} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="post-tags" className={labelClass}>
          태그 <span className="text-caption">(선택)</span>
        </label>
        <TagInput
          tags={tags}
          onTagsChange={(next) => {
            setTags(next);
            markChanged();
          }}
          draft={tagDraft}
          onDraftChange={setTagDraft}
          suggestions={options.tags}
          invalid={Boolean(errors.tags)}
          describedBy={describedBy("post-tags-hint", errors.tags && errorId("tags")) ?? ""}
        />
        <p id="post-tags-hint" className={hintClass}>
          Enter나 쉼표로 추가합니다. 목록에 없는 이름은 저장할 때 새 태그로 만듭니다.
        </p>
        <FieldError field="tags" errors={errors} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelClass} mb-2`}>
          시리즈 <span className="text-caption">(선택)</span>
        </legend>
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="post-series" className="sr-only">
              시리즈
            </label>
            <select
              id="post-series"
              name="seriesId"
              value={seriesId}
              onChange={(event) => {
                const next = event.target.value;
                setSeriesId(next);
                // 시리즈를 바꾸면 그 시리즈의 다음 순번을 제안합니다.
                setSeriesOrder(next ? nextOrder(next).toString() : "");
              }}
              aria-invalid={errors.seriesId ? true : undefined}
              aria-describedby={describedBy(errors.seriesId && errorId("seriesId"))}
              className={fieldClass}
            >
              <option value="">시리즈 없음</option>
              {options.series.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError field="seriesId" errors={errors} />
          </div>
          <div className="flex flex-col gap-2 md:w-40">
            <label htmlFor="post-series-order" className={hintClass}>
              순번
            </label>
            <input
              id="post-series-order"
              name="seriesOrder"
              type="number"
              inputMode="numeric"
              min={1}
              max={SERIES_ORDER_MAX}
              step={1}
              value={seriesOrder}
              onChange={(event) => setSeriesOrder(event.target.value)}
              disabled={!seriesId}
              aria-invalid={errors.seriesOrder ? true : undefined}
              aria-describedby={describedBy(
                seriesId && "post-series-order-hint",
                errors.seriesOrder && errorId("seriesOrder"),
              )}
              className={`${fieldClass} font-mono`}
            />
          </div>
        </div>
        {selectedSeries && (
          <p
            id="post-series-order-hint"
            className={orderTakenBy ? "text-caption text-date" : hintClass}
          >
            {orderTakenBy
              ? `${orderTakenBy.order}번은 "${orderTakenBy.title}" 글이 쓰고 있습니다.`
              : otherOrders.length > 0
                ? `이 시리즈에서 쓰는 순번: ${otherOrders.map((item) => item.order).join(", ")}`
                : "이 시리즈의 첫 글입니다."}
          </p>
        )}
        <FieldError field="seriesOrder" errors={errors} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <span id="post-content-label" className={labelClass}>
          본문
        </span>
        {legacyBody ? (
          <p
            aria-labelledby="post-content-label"
            className="rounded-xl border border-border-strong bg-surface px-5 py-6 text-body text-muted"
          >
            이 글은 에디터가 생기기 전에 HTML로 넣은 글이라 에디터 원본이 없습니다. 본문은 그대로
            두고 제목·주소·태그·시리즈·발행 설정만 바꿀 수 있습니다.
          </p>
        ) : (
          <PostEditor
            initialContent={initial.content}
            onEditorChange={setEditor}
            errorId={errors.content ? errorId("content") : undefined}
          />
        )}
        <FieldError field="content" errors={errors} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelClass} mb-2`}>발행 설정</legend>
        <div className="flex flex-col gap-2 md:flex-row">
          {PUBLISH_OPTIONS.map((option) => (
            <label
              key={option.mode}
              htmlFor={`post-publish-${option.mode}`}
              className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-border px-4 text-body has-checked:border-accent has-checked:bg-surface has-checked:font-semibold"
            >
              <input
                id={`post-publish-${option.mode}`}
                type="radio"
                name="publishMode"
                value={option.mode}
                checked={publishMode === option.mode}
                onChange={() => setPublishMode(option.mode)}
                aria-describedby="post-publish-hint"
                className="size-4 accent-accent"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p id="post-publish-hint" className={hintClass}>
          {publishMode === "draft"
            ? publicSlug
              ? "공개 중인 글을 초안으로 돌리면 공개 목록에서 내려가고 발행일이 지워집니다."
              : "공개하지 않고 저장합니다."
            : publishMode === "publish"
              ? publicSlug
                ? `공개 중입니다. 발행일(${publishedAtLabel})은 그대로 유지합니다.`
                : "저장하면 바로 공개합니다. 지금이 발행일이 됩니다."
              : "정한 시각(한국 시간)이 지나고 공개 페이지가 다시 만들어질 때 공개됩니다. 한 시간 넘게 늦을 수 있습니다."}
        </p>
        <FieldError field="publishMode" errors={errors} />

        {publishMode === "schedule" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="post-scheduled-at" className={labelClass}>
              발행 시각 (한국 시간)
            </label>
            <input
              id="post-scheduled-at"
              name="scheduledAt"
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              aria-invalid={errors.scheduledAt ? true : undefined}
              aria-describedby={describedBy(errors.scheduledAt && errorId("scheduledAt"))}
              className={`${fieldClass} font-mono md:w-64`}
            />
            <FieldError field="scheduledAt" errors={errors} />
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-border pt-6 md:flex-row md:items-center">
        <button
          type="submit"
          disabled={pending || autoState.status === "saving" || (!legacyBody && !editor)}
          className={primaryButtonClass}
        >
          {submitLabel}
        </button>
        <p role="status" className="text-meta text-muted">
          {statusMessage}
        </p>
        {autoState.status === "failed" && (
          <button
            type="button"
            onClick={() => runAutosaveRef.current()}
            className="inline-flex min-h-11 w-fit cursor-pointer items-center text-meta text-accent underline underline-offset-4 hover:text-accent-hover"
          >
            다시 시도
          </button>
        )}
      </div>
    </form>
  );
}
