"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useId } from "react";

import { LOG_LANGUAGE, resolveLanguage, SUPPORTED_LANGUAGES } from "@/lib/content/code-languages";
import { CALLOUT_TYPES, CODE_FILENAME_MAX, type CalloutType } from "@/lib/editor/extensions";
import { IMAGE_ALT_MAX, IMAGE_CAPTION_MAX } from "@/lib/editor/image-policy";

/*
 * 코드 블록·콜아웃의 편집 화면. 공개 본문과 같은 클래스(.code-block, aside[data-callout])로 그려
 * 에디터에서도 공개 페이지와 비슷하게 보이게 하고, 머리글에 언어·파일명·종류를 고르는 칸을 둡니다.
 * 머리글은 contentEditable={false}라 본문 글자로 저장되지 않습니다.
 */

const fieldClass =
  "min-h-11 rounded-md border border-border-strong bg-bg px-2 font-mono text-caption text-fg";

export function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const isLog = node.attrs.language === LOG_LANGUAGE;
  // 목록에 없는 언어(```rust 등)는 공개 페이지와 같게 text로 보여 줍니다. 바꾸기 전까지 저장값은 그대로 둡니다.
  const language = isLog ? LOG_LANGUAGE : (resolveLanguage(node.attrs.language) ?? "");

  return (
    <NodeViewWrapper as="figure" className="code-block" data-kind={isLog ? "log" : "code"}>
      <figcaption contentEditable={false} className="flex-wrap">
        <select
          aria-label="코드 언어"
          value={language}
          onChange={(event) => updateAttributes({ language: event.target.value || null })}
          className={fieldClass}
        >
          <option value="">text</option>
          {SUPPORTED_LANGUAGES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={LOG_LANGUAGE}>log (출력)</option>
        </select>
        <input
          type="text"
          aria-label="파일명"
          placeholder="파일명 (선택)"
          autoComplete="off"
          maxLength={CODE_FILENAME_MAX}
          value={node.attrs.filename ?? ""}
          onChange={(event) =>
            updateAttributes({ filename: event.target.value.trim() ? event.target.value : null })
          }
          // 에디터는 글 저장 폼 안에 있어, Enter가 폼 제출(저장·발행)로 이어지지 않게 막습니다.
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          className={`${fieldClass} min-w-0 flex-1`}
        />
      </figcaption>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export const CALLOUT_LABELS: Record<CalloutType, string> = {
  info: "정보",
  warning: "주의",
  danger: "위험",
};

export function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="aside" data-callout={node.attrs.type}>
      <div contentEditable={false}>
        <select
          aria-label="콜아웃 종류"
          value={node.attrs.type}
          onChange={(event) => updateAttributes({ type: event.target.value })}
          className={fieldClass}
        >
          {CALLOUT_TYPES.map((type) => (
            <option key={type} value={type}>
              {`${type} · ${CALLOUT_LABELS[type]}`}
            </option>
          ))}
        </select>
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}

/**
 * 이미지 편집 화면. 공개 본문과 같은 figure로 그리고, 아래에 대체 텍스트와 캡션 입력칸을 둡니다.
 * 대체 텍스트가 비어 있으면 저장(초안)은 되지만 발행·예약은 서버가 막으므로 미리 알립니다.
 */
export function ImageView({ node, updateAttributes }: ReactNodeViewProps) {
  const id = useId();
  const { src, alt, width, height, caption, uploadId } = node.attrs;
  const missingAlt = !String(alt).trim();
  // 업로드 중인 자리 표시는 브라우저의 미리보기 주소(blob:)를 보여 줍니다.
  const uploading = uploadId !== null;
  // 에디터 안의 입력칸에서 Enter가 글 저장 폼 제출로 이어지지 않게 막습니다.
  const blockEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") event.preventDefault();
  };

  return (
    <NodeViewWrapper as="figure" data-post-image="">
      {/* 관리자 편집 화면이라 원본을 그대로 보여 줍니다. 공개 페이지는 렌더링 단계에서 최적화 주소로 바꿉니다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        draggable={false}
        className={uploading ? "opacity-60" : undefined}
      />
      {uploading && <p className="mt-2 font-mono text-caption text-muted">올리는 중…</p>}
      <div contentEditable={false} className="mt-3 flex flex-col gap-2">
        <label htmlFor={`${id}-alt`} className="font-mono text-caption text-muted">
          대체 텍스트
        </label>
        <input
          id={`${id}-alt`}
          type="text"
          value={alt}
          maxLength={IMAGE_ALT_MAX}
          autoComplete="off"
          placeholder="이미지가 보여 주는 내용"
          onChange={(event) => updateAttributes({ alt: event.target.value })}
          onKeyDown={blockEnter}
          aria-invalid={missingAlt ? true : undefined}
          aria-describedby={missingAlt ? `${id}-alt-hint` : undefined}
          className={fieldClass}
        />
        {missingAlt && (
          <p id={`${id}-alt-hint`} className="text-caption text-danger">
            대체 텍스트가 없으면 발행할 수 없습니다.
          </p>
        )}
        <label htmlFor={`${id}-caption`} className="font-mono text-caption text-muted">
          캡션 <span className="text-caption">(선택)</span>
        </label>
        <input
          id={`${id}-caption`}
          type="text"
          value={caption}
          maxLength={IMAGE_CAPTION_MAX}
          autoComplete="off"
          onChange={(event) => updateAttributes({ caption: event.target.value })}
          onKeyDown={blockEnter}
          className={fieldClass}
        />
      </div>
    </NodeViewWrapper>
  );
}
