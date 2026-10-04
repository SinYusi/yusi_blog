import type { JSONContent } from "@tiptap/core";

/*
 * 에디터 문서를 서버 액션으로 보낼 때의 형식. 미리보기(#37)와 저장(#38)이 같이 씁니다.
 *
 * editor.getJSON()을 객체 그대로 넘기면 안 됩니다. ProseMirror가 만드는 노드 attrs는 프로토타입이 없는 객체(Object.create(null))라
 * React 서버 액션 직렬화가 값을 보내지 않고 임시 참조("$T")로 바꾸고, 서버는 소제목 단계 같은 속성을 받지 못합니다.
 * 그래서 JSON 문자열로 바꿔 보내고 서버에서 다시 읽습니다. JSON 문자열에는 일반 값만 남습니다.
 */

/** 서버가 받는 본문 JSON 문자열의 최대 크기(바이트). 서버 액션 요청 본문 기본 한도(1MB)와 맞춥니다. */
export const MAX_EDITOR_JSON_BYTES = 1024 * 1024;

/** 에디터 문서 → 서버 액션 인자(JSON 문자열). */
export function serializeEditorDoc(doc: JSONContent) {
  return JSON.stringify(doc);
}
