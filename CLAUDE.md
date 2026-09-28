@AGENTS.md

# Project context

- 프로젝트 스펙: docs/SPEC.md
- 로드맵과 진행 상황: docs/ROADMAP.md (작업 완료 시 체크리스트 갱신)
- 기술 결정 기록: docs/adr/ (주요 기술 선택 시 ADR 추가)
- 패키지 매니저: pnpm

# Workflow

작업 흐름 전체는 docs/CONTRIBUTING.md를 따른다. 기본 브랜치는 `dev`이고, `main`은 릴리스 PR로만 변경한다. Claude가 맡는 범위는 이슈 생성부터 리뷰 반영까지이며, 머지는 사용자가 한다.

1. `gh issue create`로 이슈를 만든다. 본문은 .github/ISSUE_TEMPLATE에서 작업 종류에 맞는 템플릿의 필수 항목을 따르고(버그는 현상, 재현 방법, 기대 동작), 템플릿의 라벨과 로드맵 단계 마일스톤을 붙인다.
2. 최신 `dev`에서 `<type>/<이슈번호>-<짧은-설명>` 브랜치를 만든다.
3. 작업하고, 커밋 전에 format:check, lint, typecheck, build를 통과시킨다.
4. `dev`를 대상으로 .github/pull_request_template.md 형식의 PR을 만들고 `Closes #이슈번호`를 넣는다.
5. CodeRabbit, Gemini 리뷰를 기다린다 (자동 리뷰는 PR을 열 때만. push 후 재리뷰는 직접 요청). 리뷰가 달리지 않으면 `@coderabbitai review`, `@gemini-cli /review`로 요청한다. 머지 전 필수 리뷰는 변경 범위에 따라 다르다(docs/CONTRIBUTING.md 5단계 표: 문서만 바꾸면 Gemini만).
6. 타당한 지적은 반영하고 스레드에 반영 커밋을 답글로 단 뒤 해결 처리한다. 반영하지 않는 지적에는 근거를 답글로 남긴다.
7. CI 통과와 리뷰 반영이 끝나면 사용자에게 머지를 요청한다. 직접 머지하지 않는다.
8. 머지 후 다음 작업 전에 `dev`를 pull한다.
9. 릴리스는 사용자가 지시할 때만 `dev` → `main` PR로 만들고 `release` 라벨을 붙인다 (merge commit으로 머지, AI 재리뷰 없음). 머지되면 annotated 태그와 GitHub Release(하이라이트 + 자동 목록)를 만든다 (docs/CONTRIBUTING.md 릴리스 절).
10. 재리뷰: 리뷰어의 코드 제안을 그대로 적용한 커밋만 생략한다. 직접 작성한 수정은 다시 리뷰받는다. CodeRabbit 리뷰를 기다리는 PR이 있으면 새 PR은 그 뒤에 연다(자동 리뷰가 시간당 한도를 쓰므로).
