# 0003. AI 코드 리뷰를 PR 흐름에 도입

- 상태: 승인 (Gemini 리뷰는 [ADR-0008](0008-replace-gemini-with-codex.md)로 대체)
- 날짜: 2026-09-27

## 배경

1인 프로젝트라 사람 리뷰어가 없다. 머지 전에 버그, 보안 문제, 설계 문제를 발견할 수 있는 리뷰 단계가 필요하다. 비용은 무료 범위 안에서 해결하고 싶다.

## 선택지

1. **CodeRabbit:** 공개 저장소는 Pro 기능까지 무료. GitHub 앱 설치만으로 PR마다 자동 리뷰.
2. **Gemini Code Assist (GitHub 앱):** 개인용 버전은 2026-07-17에 서비스 종료. 엔터프라이즈 버전만 남음.
3. **Gemini CLI GitHub Action:** Google AI Studio 무료 API 키로 사용. 워크플로 파일로 직접 구성.
4. **GitHub Copilot 코드 리뷰:** 무료 요금제에는 포함되지 않음.

## 결정

CodeRabbit과 Gemini API(직접 구현한 리뷰 스크립트)를 함께 사용한다.

- 서로 다른 모델이 리뷰해서 한쪽이 놓친 문제를 다른 쪽이 잡을 수 있다.
- Gemini 리뷰는 처음에 공식 `run-gemini-cli` 액션과 GitHub MCP 서버로 구성했지만, 다음 문제로 직접 구현한 스크립트(`.github/gemini-review/`)로 교체했다.
  - 공식 예제의 리뷰 프롬프트가 저장소와 PR 번호를 전달받지 못했다.
  - 가벼운 모델(Flash-Lite)이 존재하지 않는 도구 이름을 지어내거나(`mcp__github__get_me`) 잘못된 형식의 도구 호출(`MALFORMED_FUNCTION_CALL`)을 만들었다. 그런데도 CLI는 성공으로 종료해 리뷰 누락을 알아채기 어려웠다.
  - 리뷰 1건에 요청이 10~25회 사용되어, 무료 한도가 하루 20회인 모델로는 하루 1건 정도만 리뷰할 수 있었다.
- 교체한 구조: 스크립트가 PR 정보와 diff를 수집하고, Gemini API를 구조화된 출력(JSON 스키마)으로 한 번 호출한 뒤, 코멘트 줄 번호가 diff 범위 안에 있는지 검증하고 PR 리뷰로 게시한다. 범위를 벗어난 코멘트는 요약에 모은다.
- 공개 저장소이므로 코멘트로 리뷰를 요청하는 기능은 OWNER, MEMBER, COLLABORATOR로 제한하고, fork에서 온 PR에서는 실행하지 않는다.

## 결과

- 작업 흐름: PR 생성 → AI 리뷰 → 리뷰 반영 → CI 통과 → 머지 ([CLAUDE.md](../../CLAUDE.md) 참고).
- AI 리뷰가 틀릴 수 있으므로, 반영하지 않는 지적에는 근거를 남기는 답글을 단다.
- 무료 사용량 한도와 서비스 약관이 바뀔 수 있으므로 주기적으로 확인한다.
- 리뷰 언어와 중점 항목은 `.coderabbit.yaml`, `.github/gemini-review/prompt.md`로 관리한다.
- 사용할 Gemini 모델은 저장소 변수 `GEMINI_MODEL`로 바꿀 수 있다.
