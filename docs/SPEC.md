# 프로젝트 스펙

> 최종 수정: 2026-10-02

## 1. 개요

| 항목      | 내용                                                              |
| --------- | ----------------------------------------------------------------- |
| 프로젝트  | 자체 CMS를 갖춘 개인 기술 블로그                                  |
| 목적      | 프론트엔드 개발자(신입) 포트폴리오 및 기술 글 발행                |
| 사용자    | 독자(비로그인), 관리자(작성자 1인)                                |
| 핵심 방향 | 백엔드는 Next.js 내부에서 필요한 만큼만, 깊이는 프론트엔드에 투자 |

## 2. 기술 스택

| 영역            | 선택                                  | 선택 이유                                                                                            |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 프레임워크      | Next.js (App Router) + TypeScript     | RSC, SSG/ISR, Server Actions를 한 프로젝트에서 모두 다룸 ([ADR-0001](adr/0001-nextjs-app-router.md)) |
| 스타일          | Tailwind CSS + 자체 UI 컴포넌트       | UI 라이브러리 대신 디자인 토큰과 컴포넌트를 직접 구축                                                |
| DB / ORM        | PostgreSQL(Neon) + Drizzle ORM        | 타입 안전한 쿼리, 서버리스 환경 적합 ([ADR-0002](adr/0002-self-hosted-cms.md))                       |
| 인증            | Auth.js (GitHub OAuth)                | 관리자 1인 인증, `proxy.ts` 기반 라우트 보호 ([ADR-0009](adr/0009-admin-auth.md))                    |
| 에디터          | Tiptap (ProseMirror)                  | 확장을 직접 작성할 수 있는 블록 에디터                                                               |
| 코드 하이라이트 | Shiki                                 | 서버 렌더링으로 클라이언트 JS 0                                                                      |
| 이미지 저장소   | Cloudflare R2 또는 Vercel Blob        | `next/image`와 결합해 최적화                                                                         |
| 테스트          | Vitest, Testing Library, Playwright   | 단위, 컴포넌트, E2E                                                                                  |
| 문서화          | Storybook                             | 디자인 시스템 문서화                                                                                 |
| 배포 / CI       | Vercel, GitHub Actions, Lighthouse CI | PR마다 lint, test, 성능 측정                                                                         |
| 모니터링        | Vercel Analytics, Sentry              | 실사용자 Web Vitals, 에러 추적                                                                       |
| 패키지 매니저   | pnpm                                  |                                                                                                      |

## 3. 기능 범위

### 3.1 공개 블로그 (독자)

| 기능            | 설명                                              | 우선순위 |
| --------------- | ------------------------------------------------- | -------- |
| 글 목록         | 최신순, 페이지네이션                              | P0       |
| 글 상세         | 본문 렌더링, 코드 하이라이트(Shiki)               | P0       |
| SEO             | 메타데이터, 동적 OG 이미지, sitemap, RSS, JSON-LD | P0       |
| 태그 / 시리즈   | 태그별, 시리즈별 글 모음                          | P1       |
| 목차(TOC)       | 제목 기반 자동 생성, 스크롤 위치 연동 하이라이트  | P1       |
| 다크 모드       | 시스템 설정 연동, FOUC 없음                       | P1       |
| 검색            | Postgres 전문 검색, 디바운스, 결과 하이라이트     | P1       |
| 조회수 / 좋아요 | 낙관적 업데이트                                   | P2       |
| 댓글            | Giscus로 시작 (자체 구현은 이후 검토)             | P2       |

### 3.2 관리자 CMS (작성자)

| 기능                   | 설명                                      | 우선순위 |
| ---------------------- | ----------------------------------------- | -------- |
| 인증                   | GitHub OAuth, 허용된 계정만 `/admin` 접근 | P0       |
| 글 작성 / 수정         | Tiptap 블록 에디터                        | P0       |
| 발행 상태              | 초안, 발행, 예약 발행                     | P0       |
| On-demand revalidation | 발행·수정 시 해당 페이지만 재생성         | P0       |
| 이미지 업로드          | 드래그 앤 드롭, 붙여넣기                  | P1       |
| 자동 저장              | 디바운스 기반 임시 저장, 저장 상태 표시   | P1       |
| 에디터 확장            | 슬래시 커맨드, 코드 블록, 콜아웃          | P1       |
| 대시보드               | 글별 조회수 통계                          | P2       |

## 4. 렌더링 전략

| 영역                   | 전략                                | 이유                              |
| ---------------------- | ----------------------------------- | --------------------------------- |
| 글 목록, 글 상세, 태그 | SSG + ISR (on-demand revalidation)  | 읽기 위주 콘텐츠, 빠른 TTFB와 SEO |
| 검색 결과              | 동적 렌더링                         | 쿼리마다 결과가 다름              |
| 조회수 / 좋아요        | 클라이언트 컴포넌트 + Server Action | 정적 페이지 안의 동적 영역만 분리 |
| 관리자                 | 동적 렌더링, 인증 필요              | 캐시 대상 아님                    |

## 5. 데이터 모델

정의는 `src/db/schema.ts`, 변경 이력은 `drizzle/` 마이그레이션 파일이 기준입니다.

**1단계 (확정)**

```
posts        id, slug(unique), title, summary, content(jsonb, 에디터 원본), content_html,
             status(draft|published|scheduled), published_at,
             series_id → series(삭제 제한), series_order, view_count, like_count,
             created_at, updated_at
series       id, slug(unique), name, description, created_at, updated_at
tags         id, slug(unique), name(unique), created_at, updated_at
post_tags    post_id → posts(연쇄 삭제), tag_id → tags(연쇄 삭제), PK(post_id, tag_id)
```

DB 제약으로 지키는 규칙:

- 발행·예약 상태의 글은 발행일(`published_at`)이 있어야 한다.
- `series_id`와 `series_order`는 함께 있거나 함께 비어 있어야 하며, 순서는 1 이상이고 한 시리즈 안에서 겹치지 않는다.
- 글이 남아 있는 시리즈는 삭제할 수 없다.
- 조회수·좋아요는 0 이상이다.

**2단계 (추가)**

```
post_slug_redirects  old_slug(PK), post_id → posts(연쇄 삭제), created_at
tags                 unique(lower(name)) 추가: 대소문자만 다른 태그 이름 금지
```

- 글의 slug를 바꾸면 이전 slug를 그 글 몫으로 남기고, 글이 공개 중이면 이전 주소를 새 주소로 영구 이동(308)한다 ([ADR-0012](adr/0012-post-slug-and-redirects.md)).

관리자 저장 규칙 (`src/lib/admin/post-input.ts`, `post-mutations.ts`):

- 발행 설정은 초안(`draft`, 발행 시각 없음) / 발행(`published`, 이미 공개된 글은 처음 발행 시각 유지, 아니면 저장 시각) / 예약(`scheduled`, 입력한 한국 시간, 지금보다 뒤)이다. 발행·예약하려면 본문이 있어야 한다.
- 바뀐 것이 없으면 저장하지 않는다. 태그·시리즈 연결만 바뀌어도 `updated_at`을 갱신한다.

**2단계 (예정)**

```
users        id, github_id, name, avatar_url, role
images       id, url, width, height, alt, post_id, created_at
```

## 6. 디렉터리 구조

```
src/
  app/
    (site)/         공개 블로그 라우트 (공개 머리글·바닥글 레이아웃)
    admin/          관리자 CMS 라우트 (login, (panel): 사이드바 레이아웃)
    api/auth/       Auth.js 라우트
    feed.xml/       RSS (Route Handler), sitemap.ts, robots.ts
    globals.css     디자인 토큰 (@theme)
  auth.ts           Auth.js 설정 (ADR-0009)
  proxy.ts          /admin 앞단 세션 확인
  components/
    layout/         머리글, 바닥글, 메뉴, 404
    posts/          글 목록 컴포넌트
    post/           글 상세 컴포넌트 (목차, 코드 복사, 시리즈)
    admin/          관리자 컴포넌트 (editor/: Tiptap 에디터, post-form/: 글 작성·수정 폼과 삭제 확인. 관리자 글 편집 페이지에서만 import)
  db/               Drizzle 스키마, 연결, 시드 데이터
  lib/
    content/        공개 글 조회('use cache'), 본문 렌더링, 에디터 JSON → 본문 HTML 변환
    editor/         에디터 확장 구성 (관리자 에디터와 서버 HTML 변환이 공유, ADR-0011)
    admin/          관리자 데이터 조회·저장 (requireAdmin 확인), 글 입력 검증
    auth/           관리자 확인 (requireAdmin)
scripts/            마이그레이션, 시드, DB 확인, 색 대비 검사
drizzle/            SQL 마이그레이션
docs/               스펙, 로드맵, ADR
```

## 7. 품질 목표

| 항목                         | 목표                                                     |
| ---------------------------- | -------------------------------------------------------- |
| Lighthouse (모바일, 글 상세) | Performance 95+, Accessibility 100, SEO 100              |
| LCP                          | 2.5초 이하                                               |
| CLS                          | 0.1 이하                                                 |
| INP                          | 200ms 이하                                               |
| 접근성                       | 키보드만으로 모든 기능 사용 가능, axe 위반 0건           |
| 테스트                       | 핵심 흐름(작성 → 발행 → 노출) E2E 테스트 필수            |
| CI                           | lint, 타입 체크, 테스트, Lighthouse 기준 미달 시 PR 실패 |

모든 성능 개선은 **개선 전후 수치**를 기록합니다. 기록은 [ROADMAP.md](ROADMAP.md)의 성과 기록 항목과 블로그 글로 남깁니다.

## 8. 미정 사항

| 항목                 | 후보                       | 비고               |
| -------------------- | -------------------------- | ------------------ |
| 블로그 이름 / 도메인 | -                          | 커스텀 도메인 권장 |
| 이미지 저장소        | Cloudflare R2, Vercel Blob | 2단계 시작 전 결정 |
| 댓글                 | Giscus, 자체 구현          | Giscus로 시작 예정 |
