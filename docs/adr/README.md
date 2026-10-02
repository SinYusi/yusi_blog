# 기술 결정 기록 (ADR)

중요한 기술 결정의 배경, 선택지, 결과를 기록합니다.
"왜 이렇게 만들었는가"에 대한 근거를 남기는 문서입니다.

## 목록

| 번호                                         | 제목                                          | 상태 |
| -------------------------------------------- | --------------------------------------------- | ---- |
| [0001](0001-nextjs-app-router.md)            | Next.js App Router 사용                       | 승인 |
| [0002](0002-self-hosted-cms.md)              | 자체 CMS와 PostgreSQL로 콘텐츠 관리           | 승인 |
| [0003](0003-ai-code-review.md)               | AI 코드 리뷰를 PR 흐름에 도입                 | 승인 |
| [0004](0004-design-direction.md)             | 디자인 방향: 터미널 블루                      | 승인 |
| [0005](0005-neon-postgres.md)                | DB 호스팅: Neon                               | 승인 |
| [0006](0006-migrate-on-deploy.md)            | 배포 빌드 단계에서 DB 마이그레이션 적용       | 승인 |
| [0007](0007-build-verification-on-vercel.md) | 빌드 검증은 Vercel 미리보기 빌드로            | 승인 |
| [0008](0008-replace-gemini-with-codex.md)    | Gemini 리뷰를 Codex 코드 리뷰로 교체          | 승인 |
| [0009](0009-admin-auth.md)                   | 관리자 인증: Auth.js + GitHub OAuth, JWT 세션 | 승인 |
| [0011](0011-editor-content-format.md)        | 에디터 본문 저장 형식과 HTML 생성             | 승인 |

## 작성 방법

[template.md](template.md)를 복사해 `NNNN-제목.md` 형식으로 작성합니다.
