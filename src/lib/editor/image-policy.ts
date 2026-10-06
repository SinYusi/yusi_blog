/*
 * 본문 이미지 규칙(ADR-0010). 업로드 라우트·에디터·서버 검사·렌더링이 같은 값을 씁니다.
 * 이미지는 Vercel Blob 공개 저장소의 posts/ 경로에 올리고, 본문에는 그 주소만 허용합니다.
 */

export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
/** 올릴 수 있는 이미지 최대 크기. Vercel 이미지 최적화가 받는 원본 크기 안에서 정했습니다. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** Vercel 이미지 최적화가 받는 원본의 최대 가로·세로 픽셀 */
export const IMAGE_MAX_DIMENSION = 8192;
export const IMAGE_ALT_MAX = 300;
export const IMAGE_CAPTION_MAX = 300;
/** Blob 안의 업로드 경로. next.config의 images.remotePatterns도 이 경로만 허용합니다. */
export const IMAGE_PATH_PREFIX = "posts/";

const BLOB_HOST = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;

/** 본문에 넣을 수 있는 이미지 주소인지: https, Blob 공개 저장소 호스트, posts/ 경로 */
export function isAllowedImageSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    BLOB_HOST.test(url.hostname) &&
    url.pathname.startsWith(`/${IMAGE_PATH_PREFIX}`) &&
    !url.search &&
    !url.hash
  );
}

export function isImageDimension(value: unknown): value is number {
  return (
    Number.isInteger(value) && (value as number) > 0 && (value as number) <= IMAGE_MAX_DIMENSION
  );
}
