import { getSearchIndex } from "@/lib/content/posts";

/*
 * 검색 색인(ADR-0015). 검색 창이 처음 열릴 때 받아 브라우저에서 찾습니다.
 * 조회가 'use cache'(posts 태그)라 빌드 시 정적 응답으로 생성되고, 글을 저장하면 RSS·sitemap과 함께 갱신됩니다.
 */
export async function GET() {
  return Response.json(await getSearchIndex());
}
