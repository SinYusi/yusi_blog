import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { auth, isAdminGithubId, isAuthConfigured } from "@/auth";
import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES, IMAGE_PATH_PREFIX } from "@/lib/editor/image-policy";

/*
 * 본문 이미지 업로드 토큰 발급(ADR-0010). 파일은 브라우저가 Blob 저장소로 바로 올리고, 이 라우트는
 * 관리자인지 확인한 뒤 형식·크기·경로를 제한한 짧은 토큰만 발급합니다.
 * 관리자 경로 앞단(proxy.ts)은 /admin만 보므로 여기서 세션을 직접 확인합니다.
 * 업로드 완료 콜백(onUploadCompleted)은 쓰지 않습니다. 이미지 정보는 에디터가 본문에 넣어 글과 함께 저장합니다.
 */

const PATHNAME = new RegExp(`^${IMAGE_PATH_PREFIX}[a-z0-9][a-z0-9._-]{0,120}$`);

export async function POST(request: Request) {
  // 인증 변수가 없는 배포(미리보기)에서는 관리자 기능처럼 없는 경로로 둡니다.
  if (!isAuthConfigured) return new Response(null, { status: 404 });

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        if (!isAdminGithubId(session?.user?.githubId))
          throw new Error("관리자만 올릴 수 있습니다.");
        if (!PATHNAME.test(pathname)) throw new Error("올릴 수 없는 파일 이름입니다.");
        return {
          allowedContentTypes: IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: IMAGE_MAX_BYTES,
          // 이미지는 바꾸지 않고 새로 올립니다. 같은 이름이어도 덮어쓰지 않게 무작위 접미사를 붙입니다.
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "업로드를 준비하지 못했습니다." },
      { status: 400 },
    );
  }
}
