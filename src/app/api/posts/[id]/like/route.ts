import { changePostLike, parsePostId } from "@/lib/content/post-stats";

// 좋아요 누르기(POST)·취소(DELETE)(ADR-0016). 같은 브라우저에서 누른 상태는 브라우저가 기억합니다.
async function change(params: Promise<{ id: string }>, delta: 1 | -1) {
  const id = parsePostId((await params).id);
  const stats = id === null ? null : await changePostLike(id, delta);
  if (!stats) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(_request: Request, { params }: RouteContext<"/api/posts/[id]/like">) {
  return change(params, 1);
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/posts/[id]/like">) {
  return change(params, -1);
}
