import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { highlightParts, htmlToSearchText, search, type SearchDoc } from "./search";

const doc = (over: Partial<SearchDoc>): SearchDoc => ({
  slug: "a",
  title: "",
  summary: "",
  tags: [],
  publishedAt: "2026-10-01T00:00:00.000Z",
  text: "",
  ...over,
});

describe("search", () => {
  const docs = [
    doc({ slug: "render", title: "렌더링을 줄인 과정", text: "React memo로 리렌더링을 막았다" }),
    doc({
      slug: "ci",
      title: "CI 설정",
      tags: ["GitHubActions"],
      summary: "concurrency 정리",
      publishedAt: "2026-10-02T00:00:00.000Z",
    }),
    doc({
      slug: "memo",
      title: "기록",
      text: "memo 이야기",
      publishedAt: "2026-10-03T00:00:00.000Z",
    }),
  ];

  it("조사가 붙은 말도 부분 일치로 찾는다", () => {
    assert.deepEqual(
      search(docs, "렌더링").map((r) => r.doc.slug),
      ["render"],
    );
  });
  it("모든 조각이 들어 있어야 하고, 제목 일치가 본문 일치보다 앞선다", () => {
    const rankingDocs = [
      doc({
        slug: "body-memo",
        title: "기록",
        text: "memo 이야기",
        publishedAt: "2026-10-02T00:00:00.000Z",
      }),
      doc({
        slug: "title-memo",
        title: "memo 기록",
        publishedAt: "2026-10-01T00:00:00.000Z",
      }),
    ];

    assert.deepEqual(
      search(rankingDocs, "memo").map((r) => r.doc.slug),
      ["title-memo", "body-memo"],
    );

    assert.deepEqual(
      search(docs, "react 렌더링").map((r) => r.doc.slug),
      ["render"],
    );
    assert.deepEqual(
      search(docs, "memo").map((r) => r.doc.slug),
      ["memo", "render"],
    );
  });
  it("대소문자를 무시하고 태그로도 찾으며, 빈 검색어는 결과가 없다", () => {
    assert.deepEqual(
      search(docs, "githubactions").map((r) => r.doc.slug),
      ["ci"],
    );
    assert.deepEqual(search(docs, "   "), []);
  });
  it("요약에 검색어가 있으면 요약을, 없으면 본문 주변을 보여 준다", () => {
    assert.equal(search(docs, "concurrency")[0].snippet, "concurrency 정리");
    assert.match(search(docs, "리렌더링")[0].snippet, /리렌더링을 막았다/);
  });
});

describe("highlightParts", () => {
  it("겹치는 일치는 한 번만 강조한다", () => {
    assert.deepEqual(highlightParts("Next.js next", ["next", "ne"]), [
      { text: "Next", match: true },
      { text: ".js ", match: false },
      { text: "next", match: true },
    ]);
  });
});

describe("htmlToSearchText", () => {
  it("인라인 서식은 글자를 잇고 블록 경계에만 공백을 넣으며 문자 참조를 되돌린다", () => {
    assert.equal(
      htmlToSearchText(
        "<h2>제목</h2><p>리<strong>렌더링</strong> &amp; <code>memo</code></p><ul><li>a</li><li>b</li></ul>",
      ),
      "제목 리렌더링 & memo a b",
    );
  });
});

describe("분해형 한글(NFD)", () => {
  it("본문이 NFD여도 검색어 주변을 미리보기로 보여 주고 강조한다", () => {
    const nfd = (s: string) => s.normalize("NFD");
    const docs = [doc({ text: nfd("가".repeat(200) + " 리렌더링을 막았다") })];
    const [result] = search(docs, "리렌더링");
    assert.match(result.snippet, /리렌더링을 막았다/);
    assert.deepEqual(
      highlightParts(nfd("리렌더링"), ["렌더링"]).map((part) => part.match),
      [false, true],
    );
  });
});
