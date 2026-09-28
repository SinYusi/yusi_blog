# yusi_blog

자체 CMS를 갖춘 개인 기술 블로그입니다.
단순히 글을 올리는 공간이 아니라, **렌더링 전략·성능 최적화·에디터 구현·테스트·접근성**을 직접 설계하고 수치로 검증하는 프론트엔드 포트폴리오 프로젝트입니다.

## 목표

- 공개 블로그(독자용)와 관리자 CMS(작성자용)를 하나의 Next.js 애플리케이션으로 구축
- 모든 개선 작업을 **측정 가능한 지표**(Lighthouse, Core Web Vitals, 번들 크기)로 기록
- 개발 과정에서 겪은 문제와 해결 과정을 이 블로그에 직접 발행

## 기술 스택

| 영역       | 선택                                    |
| ---------- | --------------------------------------- |
| 프레임워크 | Next.js (App Router), React, TypeScript |
| 스타일     | Tailwind CSS + 자체 UI 컴포넌트         |
| DB / ORM   | PostgreSQL + Drizzle ORM                |
| 인증       | Auth.js (GitHub OAuth)                  |
| 에디터     | Tiptap (ProseMirror)                    |
| 테스트     | Vitest, Testing Library, Playwright     |
| 문서화     | Storybook                               |
| 배포 / CI  | Vercel, GitHub Actions, Lighthouse CI   |
| 모니터링   | Vercel Analytics, Sentry                |

## 문서

- [프로젝트 스펙](docs/SPEC.md): 기능 범위, 아키텍처, 품질 목표
- [로드맵](docs/ROADMAP.md): 단계별 작업 계획과 진행 상황
- [기술 결정 기록 (ADR)](docs/adr/): 기술을 선택한 이유와 트레이드오프
- [작업 흐름](docs/CONTRIBUTING.md): 이슈, 브랜치, 커밋, PR 규칙
- [디자인](docs/DESIGN.md): 색, 글꼴, 간격, 반응형 규칙, 화면·컴포넌트 목록

## 시작하기

```bash
pnpm install
cp .env.example .env.local   # DATABASE_URL 등 값 채우기
pnpm db:check                # DB 연결 확인
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.
