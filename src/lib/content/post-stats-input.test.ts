/*
 * 조회수·좋아요 입력 검증(post-stats-input.ts) 테스트. pnpm test로 실행합니다 (node:test + tsx).
 * DB 없이 글 id의 허용 범위와 같은 출처 검사에서 헤더의 우선순위를 확인합니다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSameOrigin, parsePostId } from "./post-stats-input";

describe("글 id 검증", () => {
  it("Postgres integer 범위의 양의 정수를 허용한다", () => {
    for (const value of ["1", "42", "2147483647"]) {
      assert.equal(parsePostId(value), Number(value), value);
    }
  });

  it("잘못된 형식이나 범위를 벗어난 값을 거부한다", () => {
    for (const value of ["0", "-1", "01", "1.5", "abc", "", " 1", "2147483648", "99999999999"]) {
      assert.equal(parsePostId(value), null, value);
    }
  });
});

describe("같은 출처 검사", () => {
  const url = "https://example.com/api/posts/1/view";

  it("Sec-Fetch-Site가 same-origin이면 Origin과 관계없이 허용한다", () => {
    for (const origin of [undefined, "https://example.com", "https://other.example.com"]) {
      const headers: Record<string, string> = { "Sec-Fetch-Site": "same-origin" };
      if (origin !== undefined) headers.Origin = origin;
      assert.equal(isSameOrigin(new Request(url, { headers })), true, origin);
    }
  });

  it("Sec-Fetch-Site가 cross-site·same-site·none이면 Origin이 같아도 거부한다", () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      const headers = { "Sec-Fetch-Site": site, Origin: "https://example.com" };
      assert.equal(isSameOrigin(new Request(url, { headers })), false, site);
    }
  });

  it("Sec-Fetch-Site가 없으면 Origin이 요청 URL의 출처와 같을 때 허용한다", () => {
    const headers = { Origin: "https://example.com" };
    assert.equal(isSameOrigin(new Request(url, { headers })), true);
  });

  it("Sec-Fetch-Site가 없으면 다른 호스트·포트·스킴의 Origin을 거부한다", () => {
    for (const origin of [
      "https://other.example.com",
      "https://example.com:8443",
      "http://example.com",
    ]) {
      assert.equal(isSameOrigin(new Request(url, { headers: { Origin: origin } })), false, origin);
    }
  });

  it("Sec-Fetch-Site와 Origin이 모두 없으면 거부한다", () => {
    assert.equal(isSameOrigin(new Request(url, { headers: {} })), false);
  });
});
