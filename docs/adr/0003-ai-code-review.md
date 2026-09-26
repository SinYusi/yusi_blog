# 0003. AI 코드 리뷰를 PR 흐름에 도입

- 상태: 승인
- 날짜: 2026-09-27

## 배경

1인 프로젝트라 사람 리뷰어가 없다. 머지 전에 버그, 보안 문제, 설계 문제를 발견할 수 있는 리뷰 단계가 필요하다. 비용은 무료 범위 안에서 해결하고 싶다.

## 선택지

1. **CodeRabbit:** 공개 저장소는 Pro 기능까지 무료. GitHub 앱 설치만으로 PR마다 자동 리뷰.
2. **Gemini Code Assist (GitHub 앱):** 개인용 버전은 2026-07-17에 서비스 종료. 엔터프라이즈 버전만 남음.
3. **Gemini CLI GitHub Action:** Google AI Studio 무료 API 키로 사용. 워크플로 파일로 직접 구성.
4. **GitHub Copilot 코드 리뷰:** 무료 요금제에는 포함되지 않음.

## 결정

CodeRabbit과 Gemini CLI GitHub Action을 함께 사용한다.

- 서로 다른 모델이 리뷰해서 한쪽이 놓친 문제를 다른 쪽이 잡을 수 있다.
- Gemini 리뷰는 공식 예제의 dispatch와 review 두 워크플로를 하나로 합쳐 단순화했다.
- 공식 예제가 쓰는 code-review 확장 프롬프트는 저장소와 PR 번호를 받지 못하고, GitHub MCP 서버 v0.27의 도구 이름과도 맞지 않아 리뷰가 게시되지 않았다. 그래서 프로젝트 전용 커맨드(`.gemini/commands/yusi-review.toml`)를 작성해 PR 정보를 인자로 명시적으로 전달한다.
- 공개 저장소이므로 코멘트로 리뷰를 요청하는 기능은 OWNER, MEMBER, COLLABORATOR로 제한하고, fork에서 온 PR에서는 실행하지 않는다.

## 결과

- 작업 흐름: PR 생성 → AI 리뷰 → 리뷰 반영 → CI 통과 → 머지 ([CLAUDE.md](../../CLAUDE.md) 참고).
- AI 리뷰가 틀릴 수 있으므로, 반영하지 않는 지적에는 근거를 남기는 답글을 단다.
- 무료 사용량 한도와 서비스 약관이 바뀔 수 있으므로 주기적으로 확인한다.
- 리뷰 언어와 중점 항목은 `.coderabbit.yaml`, `GEMINI.md`로 관리한다.
