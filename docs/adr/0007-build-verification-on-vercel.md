# 0007. 빌드 검증은 Vercel 미리보기 빌드로

- 상태: 승인
- 날짜: 2026-09-28

## 배경

Cache Components(`cacheComponents: true`)를 켜고 공개 페이지를 정적 생성하면서, `next build`가 빌드 중에 DB를 조회한다. DB 접속 정보가 없는 GitHub Actions CI의 `next build`는 실패한다 ([ADR-0006](0006-migrate-on-deploy.md)의 남은 과제).

## 선택지

1. **CI에 DB 접속 정보 추가**: CI용 Neon 브랜치를 두고 GitHub Secrets에 연결 문자열을 저장한다. DB 자격 증명이 Vercel 밖에도 생기고, CI용 브랜치를 따로 관리해야 한다.
2. **DB가 없으면 빈 페이지로 빌드**: CI는 통과하지만, 운영에서 DB 연결이 끊겨도 빈 블로그가 조용히 배포될 수 있다.
3. **CI는 정적 검사만, 빌드 검증은 Vercel 미리보기 빌드**: Vercel 빌드는 PR마다 운영을 복제한 DB 브랜치와 함께 실행되므로 실제 운영 빌드와 가장 가깝다.

## 결정

3을 택한다.

- GitHub Actions CI(`Lint, typecheck`)는 포맷, lint, 색 대비, 타입 검사만 한다.
- 빌드 검증은 Vercel 미리보기 배포가 맡고, 브랜치 보호 규칙의 필수 체크에 Vercel 배포 상태를 추가한다.
- 빌드 중 DB 조회가 실패하면 빌드를 실패시킨다. 빈 데이터로 대체하지 않는다.

## 결과

- DB 자격 증명은 계속 Vercel-Neon 연동에만 있다.
- 빌드 검증이 마이그레이션, 시드, 정적 생성까지 포함한 실제 배포 과정 그대로 이뤄진다.
- 필수 체크가 `Lint, typecheck`(GitHub Actions)와 `Vercel`(배포 상태)로 바뀐다. 규칙 변경은 이전 이름의 CI 체크를 쓰는 열린 PR이 모두 머지된 뒤에 적용한다.
- Vercel 장애나 빌드 대기 시간이 머지 가능 여부에 영향을 준다.
- 로컬에서는 `.env.local`(Neon `dev` 브랜치)로 `pnpm build`를 실행해 확인할 수 있다.
