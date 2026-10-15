/*
 * 글 검색(ADR-0015). 서버가 만든 공개 글 색인(/search-index.json)을 브라우저에서 부분 일치로 찾습니다.
 * 형태소 분석 없이 부분 문자열로 찾으므로 "렌더링"으로 "렌더링을"도 찾습니다.
 */
export type SearchDoc = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  /** 발행 시각(ISO) */
  publishedAt: string;
  /** 본문 글자 앞부분 */
  text: string;
};

export type SearchResult = {
  doc: SearchDoc;
  /** 결과에 보여 줄 문장. 요약에 검색어가 있으면 요약, 없으면 본문에서 검색어 주변 */
  snippet: string;
};

export const SEARCH_INDEX_PATH = "/search-index.json";
const SNIPPET_BEFORE = 30;
const SNIPPET_LENGTH = 120;

/** 비교용 정규화: 유니코드 조합(NFC)을 맞추고 소문자로, 연속 공백은 하나로 */
export function normalize(value: string) {
  return value.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function searchTerms(query: string) {
  return normalize(query).split(" ").filter(Boolean);
}

/** 모든 검색어 조각이 들어 있는 글만, 제목 > 태그 > 요약 > 본문 순 점수로 정렬해 돌려줍니다. 같은 점수면 최근 글이 먼저입니다. */
export function search(docs: SearchDoc[], query: string, limit = 20): SearchResult[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  const scored: { result: SearchResult; score: number }[] = [];
  for (const doc of docs) {
    const fields = {
      title: normalize(doc.title),
      tags: normalize(doc.tags.join(" ")),
      summary: normalize(doc.summary),
      text: normalize(doc.text),
    };
    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      const termScore =
        (fields.title.includes(term) ? 8 : 0) +
        (fields.tags.includes(term) ? 4 : 0) +
        (fields.summary.includes(term) ? 2 : 0) +
        (fields.text.includes(term) ? 1 : 0);
      if (termScore === 0) {
        matchedAll = false;
        break;
      }
      score += termScore;
    }
    if (!matchedAll) continue;
    scored.push({ result: { doc, snippet: snippetFor(doc, terms) }, score });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score || b.result.doc.publishedAt.localeCompare(a.result.doc.publishedAt),
    )
    .slice(0, limit)
    .map(({ result }) => result);
}

function snippetFor(doc: SearchDoc, terms: string[]) {
  const summary = normalize(doc.summary);
  if (doc.summary && terms.some((term) => summary.includes(term))) return doc.summary;
  const text = doc.text.replace(/\s+/g, " ");
  const lower = normalize(text);
  const at = Math.min(...terms.map((term) => lower.indexOf(term)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return doc.summary || text.slice(0, SNIPPET_LENGTH);
  const start = Math.max(0, at - SNIPPET_BEFORE);
  const piece = text.slice(start, start + SNIPPET_LENGTH);
  return `${start > 0 ? "…" : ""}${piece}${start + SNIPPET_LENGTH < text.length ? "…" : ""}`;
}

/** 강조 표시용으로 글자를 검색어와 일치하는 조각·나머지 조각으로 나눕니다(대소문자 무시). */
export function highlightParts(value: string, terms: string[]) {
  const lower = value.toLowerCase();
  const marks: [number, number][] = [];
  for (const term of terms) {
    for (let i = lower.indexOf(term); i >= 0; i = lower.indexOf(term, i + term.length)) {
      marks.push([i, i + term.length]);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of marks) {
    if (end <= cursor) continue;
    const from = Math.max(start, cursor);
    if (from > cursor) parts.push({ text: value.slice(cursor, from), match: false });
    parts.push({ text: value.slice(from, end), match: true });
    cursor = end;
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor), match: false });
  return parts;
}
