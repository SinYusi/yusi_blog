"use client";

import { useState } from "react";

import { normalizeTagName, TAG_NAME_MAX, TAGS_MAX } from "@/lib/admin/post-input";

import { fieldClass } from "./styles";

/**
 * 태그 입력. 기존 태그는 자동 완성(datalist)으로 고르고, 목록에 없는 이름을 넣으면 저장할 때 새 태그를 만듭니다.
 * Enter(또는 쉼표)로 추가합니다. 한글 입력 중(IME 조합 중)의 Enter는 글자 확정이므로 추가로 보지 않습니다.
 */
export function TagInput({
  tags,
  onTagsChange,
  draft,
  onDraftChange,
  suggestions,
  describedBy,
  invalid,
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  /** 아직 추가하지 않은 입력 중인 글자. 저장할 때 함께 태그로 보냅니다. */
  draft: string;
  onDraftChange: (value: string) => void;
  suggestions: string[];
  describedBy: string;
  invalid: boolean;
}) {
  const [notice, setNotice] = useState("");
  const known = new Set(suggestions.map((name) => name.toLowerCase()));

  // 쉼표가 든 글자(붙여 넣기 등)는 쉼표마다 나눠 여러 태그로 추가합니다. 서버도 같은 규칙으로 나눕니다.
  // 길이·개수 상한에 걸린 이름은 입력칸에 남겨, 고치거나 다른 태그를 뺀 뒤 다시 추가할 수 있게 합니다.
  function add(value = draft) {
    const next = [...tags];
    const rest: string[] = [];
    const added: string[] = [];
    // 붙여 넣은 여러 이름의 결과를 한 번에 알립니다. 뒤의 성공이 앞의 실패 안내를 덮지 않게 모읍니다.
    const problems = new Set<string>();
    for (const part of value.split(",")) {
      const name = normalizeTagName(part);
      if (!name) continue;
      if (next.some((tag) => tag.toLowerCase() === name.toLowerCase())) {
        problems.add(`"${name}" 태그는 이미 있습니다.`);
      } else if (name.length > TAG_NAME_MAX) {
        problems.add(`태그 이름은 ${TAG_NAME_MAX}자 이하로 입력하세요.`);
        rest.push(name);
      } else if (next.length >= TAGS_MAX) {
        problems.add(`태그는 ${TAGS_MAX}개까지 붙일 수 있습니다.`);
        rest.push(name);
      } else {
        // 대소문자만 다른 기존 태그가 있으면 그 이름으로 붙입니다(서버도 같은 태그로 연결합니다).
        const existing = suggestions.find((tag) => tag.toLowerCase() === name.toLowerCase());
        next.push(existing ?? name);
        added.push(existing ?? name);
      }
    }
    if (added.length === 0 && problems.size === 0) return;
    onTagsChange(next);
    setNotice(
      [
        added.length > 0 && `${added.map((name) => `"${name}"`).join(", ")} 태그를 추가했습니다.`,
        ...problems,
      ]
        .filter(Boolean)
        .join(" "),
    );
    onDraftChange(rest.join(", "));
  }

  function remove(tag: string) {
    onTagsChange(tags.filter((item) => item !== tag));
    setNotice(`"${tag}" 태그를 뺐습니다.`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          id="post-tags"
          type="text"
          list="post-tag-options"
          autoComplete="off"
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            // 쉼표를 입력하거나 쉼표가 든 글자를 붙여 넣으면 태그로 추가합니다.
            if (value.includes(",")) {
              add(value);
              return;
            }
            onDraftChange(value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            add();
          }}
          placeholder="태그 이름"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={() => add()}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-lg border border-border-strong px-4 font-mono text-meta text-muted hover:text-fg"
        >
          추가
        </button>
      </div>
      <datalist id="post-tag-options">
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {tags.length > 0 && (
        <ul aria-label="붙인 태그" className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center rounded-full border border-border-strong pl-3 font-mono text-meta text-accent"
            >
              #{tag}
              {!known.has(tag.toLowerCase()) && (
                <span className="ml-2 text-caption text-date">새 태그</span>
              )}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`${tag} 태그 빼기`}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-muted hover:text-fg"
              >
                <svg
                  aria-hidden="true"
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* 추가·삭제 결과를 화면 낭독기에 알립니다. */}
      <p role="status" className="sr-only">
        {notice}
      </p>
    </div>
  );
}
