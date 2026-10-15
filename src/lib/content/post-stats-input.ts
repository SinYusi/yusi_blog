/** 경로의 글 id. 양의 정수(Postgres integer 범위)만 받습니다. */
export function parsePostId(value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2_147_483_647 ? id : null;
}

/**
 * 카운터를 바꾸는 요청이 이 사이트 페이지에서 왔는지. 다른 사이트가 <form>이나 no-cors 요청으로 방문자 브라우저마다
 * 대신 보내 숫자를 부풀리지 못하게 합니다. Sec-Fetch-Site가 없는 브라우저는 Origin을 사이트 주소와 비교합니다.
 */
export function isSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
