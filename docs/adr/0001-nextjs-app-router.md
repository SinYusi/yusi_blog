# 0001. Next.js App Router 사용

- 상태: 승인
- 날짜: 2026-09-26

## 배경

블로그는 읽기 위주의 공개 페이지(SEO와 초기 로딩 속도가 중요)와 인증이 필요한 관리자 페이지(상호작용이 많음)를 함께 가진다. 두 영역에 서로 다른 렌더링 전략이 필요하다.

## 선택지

1. **Next.js App Router:** RSC, SSG/ISR, Server Actions, 라우트 단위 렌더링 전략 선택 가능. 학습 비용과 캐싱 모델의 복잡도가 있음.
2. **Next.js Pages Router:** 안정적이고 자료가 많지만 신규 기능은 App Router 중심으로 개발됨.
3. **Astro:** 정적 콘텐츠에는 최적이지만, 관리자 CMS처럼 상호작용이 많은 영역을 React와 함께 다루기 번거로움.
4. **Vite + React SPA:** SEO와 초기 로딩을 위해 SSR을 별도로 구성해야 함.

## 결정

Next.js App Router를 사용한다. 공개 페이지는 SSG + on-demand ISR, 관리자는 동적 렌더링과 Server Actions로 구현한다.

## 결과

- 라우트마다 렌더링 전략을 다르게 선택하고, 그 효과를 수치로 비교할 수 있다.
- 서버 컴포넌트를 활용해 클라이언트 번들을 줄일 수 있다.
- 별도 백엔드 서버 없이 Route Handlers와 Server Actions로 API를 구성한다.
- 캐싱과 revalidation 동작을 정확히 이해해야 하며, 사용 중인 버전의 공식 문서(`node_modules/next/dist/docs/`)를 기준으로 구현한다.
