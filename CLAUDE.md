@AGENTS.md

# Project context

- 프로젝트 스펙: docs/SPEC.md
- 로드맵과 진행 상황: docs/ROADMAP.md (작업 완료 시 체크리스트 갱신)
- 기술 결정 기록: docs/adr/ (주요 기술 선택 시 ADR 추가)
- 패키지 매니저: pnpm

# Workflow

작업 흐름 전체는 docs/CONTRIBUTING.md를 따른다. Claude가 맡는 범위는 이슈 생성부터 리뷰 반영까지이며, 머지는 사용자가 한다.

1. `gh issue create`로 이슈를 만든다. 본문은 .github/ISSUE_TEMPLATE의 해당 템플릿 항목(목적, 작업 내용, 완료 기준)을 따르고 라벨을 붙인다.
2. 최신 main에서 `<type>/<이슈번호>-<짧은-설명>` 브랜치를 만든다.
3. 작업하고, 커밋 전에 format:check, lint, typecheck, build를 통과시킨다.
4. .github/pull_request_template.md 형식으로 PR을 만들고 `Closes #이슈번호`를 넣는다.
5. CodeRabbit, Gemini 리뷰를 기다린다. 리뷰가 달리지 않으면 `@coderabbitai review`, `@gemini-cli /review`로 요청한다.
6. 타당한 지적은 반영하고 스레드에 반영 커밋을 답글로 단 뒤 해결 처리한다. 반영하지 않는 지적에는 근거를 답글로 남긴다.
7. CI 통과와 리뷰 반영이 끝나면 사용자에게 머지를 요청한다. 직접 머지하지 않는다.
8. 머지 후 다음 작업 전에 main을 pull한다.
