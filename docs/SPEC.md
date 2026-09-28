# 프로젝트 스펙

> 최종 수정: 2026-09-26

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
| 인증            | Auth.js (GitHub OAuth)                | 관리자 1인 인증, 미들웨어 기반 라우트 보호                                                           |
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

## 5. 데이터 모델 (초안)

```
users        id, github_id, name, avatar_url, role
posts        id, slug, title, summary, content(JSON), content_html,
             status(draft|published|scheduled), published_at,
             series_id, view_count, like_count, created_at, updated_at
tags         id, name, slug
post_tags    post_id, tag_id
series       id, name, slug, description
images       id, url, width, height, alt, post_id, created_at
```

세부 스키마는 1단계에서 확정합니다.

## 6. 디렉터리 구조 (초안)

```
src/
  app/
    (blog)/         공개 블로그 라우트
    admin/          관리자 CMS 라우트
    api/            Route Handlers (OG 이미지, RSS 등)
  components/
    ui/             디자인 시스템 기본 컴포넌트
    blog/           블로그 전용 컴포넌트
    editor/         Tiptap 에디터와 확장
  lib/
    db/             Drizzle 스키마, 쿼리
    auth/           인증 설정
  styles/           디자인 토큰
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
