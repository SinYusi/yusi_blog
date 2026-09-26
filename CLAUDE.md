@AGENTS.md

# Project context

- 프로젝트 스펙: docs/SPEC.md
- 로드맵과 진행 상황: docs/ROADMAP.md (작업 완료 시 체크리스트 갱신)
- 기술 결정 기록: docs/adr/ (주요 기술 선택 시 ADR 추가)
- 패키지 매니저: pnpm

# Workflow

1. 작업마다 브랜치를 만들고 PR을 올린다. main에 직접 push하지 않는다.
2. AI 리뷰(CodeRabbit, Gemini)를 기다린다. Gemini 재리뷰는 PR 코멘트 `@gemini-cli /review`, CodeRabbit 재리뷰는 `@coderabbitai review`.
3. 리뷰 코멘트를 검토해 타당한 지적은 반영하고, 반영하지 않는 지적에는 근거를 답글로 남긴다.
4. CI가 통과하면 머지한다.
