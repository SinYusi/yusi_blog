import { addPostView } from "@/lib/content/post-stats";
import { isSameOrigin, parsePostId } from "@/lib/content/post-stats-input";

// 조회 1회 집계(ADR-0016). 같은 브라우저·같은 글의 중복(3시간)은 브라우저가 거릅니다.
export async function POST(request: Request, { params }: RouteContext<"/api/posts/[id]/view">) {
  if (!isSameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const id = parsePostId((await params).id);
  const stats = id === null ? null : await addPostView(id);
  if (!stats) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
}
