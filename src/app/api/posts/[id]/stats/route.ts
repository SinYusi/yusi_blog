import { getPostStats } from "@/lib/content/post-stats";
import { parsePostId } from "@/lib/content/post-stats-input";

// 글의 조회수·좋아요(ADR-0016). 방문마다 바뀌므로 캐시하지 않습니다.
export async function GET(_request: Request, { params }: RouteContext<"/api/posts/[id]/stats">) {
  const id = parsePostId((await params).id);
  const stats = id === null ? null : await getPostStats(id);
  if (!stats) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
}
