/**
 * 개발·미리보기용 시드 데이터. 이 프로젝트에서 실제로 겪은 일을 글감으로 씁니다.
 *
 * 본문 HTML 규칙 (#21의 본문 렌더링과 스타일, 에디터의 HTML 생성(lib/content/editor-html.ts)이 이 규칙을 따릅니다)
 * - 소제목: <h2 id="...">, <h3 id="...">. h2의 id는 목차 링크에 씁니다. id는 접두사 없이 저장하고,
 *   렌더링 단계(render.ts)가 정화하면서 sec-를 붙입니다. 에디터 글의 id는 소제목 텍스트로 만들고(한글 허용),
 *   문서 안에서 겹치면 -2, -3을 붙입니다.
 * - 문단·목록·인용·링크·굵게·기울임·인라인 코드: <p>, <ul>/<ol>/<li>, <blockquote>, <a href>, <strong>, <em>, <code>
 * - 코드: <pre data-language="..." data-filename="..."><code>...</code></pre>. 하이라이트는 렌더링 단계에서 합니다.
 * - 로그: <pre data-language="log"><code>...</code></pre>
 * - 콜아웃: <aside data-callout="info|warning|danger">...</aside>
 * - 이미지: <figure><img src="Blob 공개 주소" alt="..." width="..." height="..."><figcaption>...</figcaption></figure>
 *   (캡션은 선택). 렌더링 단계가 최적화 주소(srcset)로 바꿉니다(ADR-0010).
 */

function escapeHtml(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function code(language: string, source: string, filename?: string) {
  const fileAttr = filename ? ` data-filename="${escapeHtml(filename)}"` : "";
  return `<pre data-language="${language}"${fileAttr}><code>${escapeHtml(source.trim())}</code></pre>`;
}

function callout(type: "info" | "warning" | "danger", html: string) {
  return `<aside data-callout="${type}">${html}</aside>`;
}

function h2(id: string, text: string) {
  return `<h2 id="${id}">${text}</h2>`;
}

export const seedSeries = [
  {
    slug: "building-this-blog",
    name: "블로그 만들기",
    description: "이 블로그를 설계하고 만드는 과정. 기술 선택, 작업 흐름, 렌더링 전략.",
  },
  {
    slug: "ai-code-review-pipeline",
    name: "AI 코드 리뷰 파이프라인",
    description:
      "무료 도구로 1인 프로젝트에 AI 코드 리뷰를 붙이고, 실제로 겪은 실패를 고쳐 나간 기록.",
  },
] as const;

export const seedTags = [
  { slug: "nextjs", name: "Next.js" },
  { slug: "architecture", name: "설계" },
  { slug: "ai-code-review", name: "AI코드리뷰" },
  { slug: "ci", name: "CI" },
  { slug: "troubleshooting", name: "트러블슈팅" },
  { slug: "github-actions", name: "GitHubActions" },
  { slug: "git", name: "Git" },
  { slug: "collaboration", name: "협업" },
] as const;

type SeedTagSlug = (typeof seedTags)[number]["slug"];
type SeedSeriesSlug = (typeof seedSeries)[number]["slug"];

export type SeedPost = {
  slug: string;
  title: string;
  summary: string;
  contentHtml: string;
  status: "draft" | "published" | "scheduled";
  publishedAt: Date | null;
  series?: { slug: SeedSeriesSlug; order: number };
  tags: SeedTagSlug[];
};

export const seedPosts: SeedPost[] = [
  {
    slug: "tech-stack-and-rendering",
    title: "블로그를 만들며 정한 기술 스택과 렌더링 전략",
    summary:
      "공개 페이지는 SSG와 on-demand ISR, 관리자는 동적 렌더링. 자체 CMS를 선택한 이유와 트레이드오프.",
    status: "published",
    publishedAt: new Date("2026-09-26T21:00:00+09:00"),
    series: { slug: "building-this-blog", order: 1 },
    tags: ["nextjs", "architecture"],
    contentHtml: [
      `<p>이 블로그는 글을 올리는 공간이면서, 렌더링 전략과 성능을 직접 설계하고 수치로 확인하는 프로젝트입니다. 시작하면서 두 가지를 먼저 정했습니다. 어떤 프레임워크로 만들지, 글을 어디에 저장할지.</p>`,
      h2("framework", "Next.js App Router"),
      `<p>공개 페이지는 읽기 위주라 초기 로딩과 검색 노출이 중요하고, 관리자 화면은 상호작용이 많습니다. 두 영역에 서로 다른 렌더링이 필요해서, 라우트마다 전략을 고를 수 있는 App Router를 골랐습니다.</p>`,
      `<table><thead><tr><th>영역</th><th>전략</th><th>이유</th></tr></thead><tbody><tr><td>글 목록, 글 상세</td><td>정적 생성 + on-demand revalidation</td><td>읽기 위주, 빠른 첫 응답</td></tr><tr><td>검색</td><td>동적 렌더링</td><td>검색어마다 결과가 다름</td></tr><tr><td>관리자</td><td>동적 렌더링</td><td>인증 필요, 캐시 대상 아님</td></tr></tbody></table>`,
      h2("cms", "자체 CMS를 고른 이유"),
      `<p>Markdown 파일로 글을 관리하면 가장 빠르게 만들 수 있지만, 에디터·자동 저장·발행 흐름을 구현해 볼 기회가 없습니다. 작업량이 늘더라도 전 과정을 직접 설계하는 쪽을 택했습니다.</p>`,
      callout(
        "info",
        `<p><strong>결정 기록.</strong> 선택지와 트레이드오프는 저장소의 ADR(docs/adr)에 남겨 두었습니다.</p>`,
      ),
    ].join("\n"),
  },
  {
    slug: "free-ai-code-review",
    title: "1인 프로젝트에 무료 AI 코드 리뷰 붙이기",
    summary:
      "CodeRabbit과 Gemini를 함께 쓰면서 확인한 무료 한도와, 두 리뷰어가 서로 다른 문제를 찾는 이유.",
    status: "published",
    publishedAt: new Date("2026-09-27T10:00:00+09:00"),
    series: { slug: "ai-code-review-pipeline", order: 1 },
    tags: ["ai-code-review", "ci"],
    contentHtml: [
      `<p>혼자 하는 프로젝트에는 리뷰어가 없습니다. 머지 전에 버그와 보안 문제를 한 번 더 걸러 줄 장치가 필요해서, 무료로 쓸 수 있는 AI 리뷰어 두 개를 PR 흐름에 붙였습니다.</p>`,
      h2("tools", "고른 도구"),
      `<table><thead><tr><th>도구</th><th>무료 조건</th><th>방식</th></tr></thead><tbody><tr><td>CodeRabbit</td><td>공개 저장소 무료, 시간당 리뷰 1회</td><td>GitHub 앱</td></tr><tr><td>Gemini</td><td>모델별 하루 요청 한도</td><td>직접 만든 GitHub Actions 워크플로</td></tr></tbody></table>`,
      h2("difference", "두 리뷰어가 찾는 것이 다르다"),
      `<p>첫 PR에서 CodeRabbit은 워크플로의 권한 과다, 버전을 고정하지 않은 액션, fork PR 검사 누락을 찾았습니다. 같은 변경에서 Gemini는 문서 간 정합성을 짚었습니다. 한쪽만 썼다면 놓쳤을 문제들입니다.</p>`,
      callout(
        "warning",
        `<p><strong>AI 리뷰도 틀린다.</strong> 문서에 없는 값을 근거로 한 지적도 있었습니다. 지적마다 코드와 문서로 직접 확인하고, 반영하지 않을 때는 이유를 답글로 남깁니다.</p>`,
      ),
    ].join("\n"),
  },
  {
    slug: "gemini-review-silent-failure",
    title: "Gemini 코드 리뷰가 ‘성공’했는데 리뷰가 없던 이유",
    summary:
      "가벼운 모델이 존재하지 않는 도구를 호출하고도 정상 종료하던 문제를 추적하고, 구조화된 출력으로 해결한 과정.",
    status: "published",
    publishedAt: new Date("2026-09-27T18:00:00+09:00"),
    series: { slug: "ai-code-review-pipeline", order: 2 },
    tags: ["ci", "ai-code-review", "troubleshooting"],
    contentHtml: [
      `<p>GitHub Actions에서 Gemini로 PR을 리뷰하도록 설정했습니다. 워크플로는 매번 초록색으로 끝났는데, PR에는 리뷰가 하나도 달리지 않았습니다.</p>`,
      h2("logs", "로그에 남은 것"),
      `<p>디버그 모드로 다시 실행하자 원인이 보였습니다. 모델은 존재하지 않는 도구 이름을 지어내 호출했고, 호출이 모두 실패했는데도 PR을 읽지 않은 채 요약을 만들어 냈습니다.</p>`,
      code(
        "log",
        `Error executing tool mcp__github__get_me: Tool "mcp__github__get_me" not found.
Error executing tool run_shell_command: Tool "run_shell_command" not found.
"totalCalls": 5, "totalSuccess": 0, "totalFail": 5`,
      ),
      callout(
        "warning",
        `<p><strong>성공 표시를 믿지 말 것.</strong> 모델이 도구 호출에 실패해도 CLI는 종료 코드 0을 반환했습니다. 결과물이 실제로 생겼는지 확인하는 단계가 따로 필요합니다.</p>`,
      ),
      h2("structured-output", "도구 호출 대신 구조화된 출력"),
      `<p>모델에게 GitHub를 직접 다루게 하지 않고, 스크립트가 diff를 넘긴 뒤 JSON으로 리뷰만 받도록 바꿨습니다. 코멘트 위치는 스크립트가 diff 범위와 대조해 검증합니다.</p>`,
      code(
        "python",
        `# 모델은 JSON만 반환하고, 게시는 스크립트가 맡는다
result = call_gemini(model, api_key, system_prompt, user_prompt)
for comment in result["comments"]:
    side = comment["side"]
    if comment["line"] in allowed[comment["path"]][side]:
        inline.append(comment)
    else:
        misplaced.append(comment)`,
        ".github/gemini-review/review.py",
      ),
      h2("result", "바뀐 것"),
      `<table><thead><tr><th>항목</th><th>이전</th><th>이후</th></tr></thead><tbody><tr><td>리뷰 1건당 API 요청</td><td>8회</td><td>1회</td></tr><tr><td>실행 시간</td><td>3분 32초</td><td>12초</td></tr><tr><td>조용한 실패</td><td>있음</td><td>없음</td></tr></tbody></table>`,
    ].join("\n"),
  },
  {
    slug: "solo-git-flow",
    title: "dev 브랜치와 브랜치 보호 규칙으로 만드는 1인 Git Flow",
    summary:
      "이슈 → 브랜치 → PR → AI 리뷰 → 머지. 문서로만 정한 규칙을 저장소 설정으로 강제하기까지.",
    status: "published",
    publishedAt: new Date("2026-09-28T09:00:00+09:00"),
    series: { slug: "building-this-blog", order: 2 },
    tags: ["git", "collaboration"],
    contentHtml: [
      `<p>작업 흐름을 문서로 정해 두었지만, 문서는 실수를 막아 주지 않습니다. main과 dev에 직접 push하거나 CI가 실패한 채 머지하는 일을 저장소 설정으로 막았습니다.</p>`,
      h2("rules", "브랜치 보호 규칙"),
      `<table><thead><tr><th>규칙</th><th>dev</th><th>main</th></tr></thead><tbody><tr><td>PR 필수</td><td>✓</td><td>✓</td></tr><tr><td>CI 통과 필수</td><td>✓</td><td>✓</td></tr><tr><td>리뷰 스레드 해결 필수</td><td>✓</td><td>✓</td></tr><tr><td>허용 머지 방식</td><td>Squash</td><td>Merge commit</td></tr></tbody></table>`,
      callout(
        "info",
        `<p><strong>왜 main은 merge commit인가.</strong> 릴리스 PR까지 squash하면 main에 dev와 다른 커밋이 생겨, 다음 릴리스에서 이미 반영한 변경이 다시 차이로 잡힙니다.</p>`,
      ),
    ].join("\n"),
  },
  {
    slug: "concurrency-cancels-review",
    title: "봇 코멘트 하나가 GitHub Actions 작업을 취소하던 문제",
    summary:
      "concurrency를 워크플로 수준에 두면 if 조건보다 먼저 평가된다. 결국 건너뛸 실행이 진행 중인 리뷰를 취소하던 원인과 해결.",
    status: "published",
    publishedAt: new Date("2026-09-28T13:00:00+09:00"),
    series: { slug: "ai-code-review-pipeline", order: 3 },
    tags: ["github-actions", "troubleshooting"],
    contentHtml: [
      `<p>PR을 열면 Gemini 리뷰가 시작되는데, 곧바로 취소되곤 했습니다. 원인은 다른 봇이 단 코멘트였습니다.</p>`,
      h2("cause", "원인"),
      `<p>코멘트마다 issue_comment 이벤트로 같은 워크플로가 실행됩니다. 이 실행은 if 조건에 걸려 결국 건너뛰지만, 워크플로 수준의 concurrency는 if보다 먼저 평가되어 진행 중인 리뷰를 취소했습니다.</p>`,
      h2("fix", "해결"),
      code(
        "yaml",
        `jobs:
  review:
    if: github.event_name == 'pull_request' || startsWith(github.event.comment.body, '@gemini-cli /review')
    # job 수준에 두면, if로 건너뛰는 실행은 그룹에 들어가지 않는다
    concurrency:
      group: gemini-review-\${{ github.event.pull_request.number || github.event.issue.number }}
      cancel-in-progress: true`,
        ".github/workflows/gemini-review.yml",
      ),
      callout(
        "danger",
        `<p><strong>수정은 기본 브랜치에 머지된 뒤에 효과가 있다.</strong> issue_comment 워크플로는 기본 브랜치의 파일로 실행되므로, 수정한 PR 자신에서는 여전히 취소가 일어났습니다.</p>`,
      ),
    ].join("\n"),
  },
  {
    slug: "neon-preview-branches",
    title: "Neon 브랜치로 미리보기 배포마다 DB 분리하기",
    summary:
      "PR 미리보기마다 운영 DB를 복제한 브랜치를 만들고, 빌드 단계에서 마이그레이션을 적용하는 흐름.",
    status: "draft",
    publishedAt: null,
    series: { slug: "building-this-blog", order: 3 },
    tags: ["architecture"],
    contentHtml: `<p>작성 중인 글입니다.</p>`,
  },
  {
    slug: "design-tokens-contrast-ci",
    title: "디자인 토큰과 색 대비를 CI에서 검사하기",
    summary: "토큰의 글자·배경 조합이 WCAG AA에 못 미치면 CI가 실패하도록 만든 과정.",
    status: "scheduled",
    publishedAt: new Date("2026-10-05T09:00:00+09:00"),
    tags: ["ci", "architecture"],
    contentHtml: `<p>예약 발행 예정인 글입니다.</p>`,
  },
];
