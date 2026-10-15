import { addPostView, parsePostId } from "@/lib/content/post-stats";

// 조회 1회 집계(ADR-0016). 같은 브라우저·같은 글의 중복(3시간)은 브라우저가 거릅니다.
export async function POST(_request: Request, { params }: RouteContext<"/api/posts/[id]/view">) {
  const id = parsePostId((await params).id);
  const stats = id === null ? null : await addPostView(id);
  if (!stats) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
}
