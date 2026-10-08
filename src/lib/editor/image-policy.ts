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

/**
 * 이 배포가 쓰는 Blob 공개 저장소의 호스트. 저장소 id(BLOB_STORE_ID, 저장소를 연결하면 Vercel이 넣음)에서
 * "store_"를 뗀 값의 소문자가 호스트 앞부분입니다. 다른 Vercel Blob 사용자의 저장소 주소를 받지 않기 위해
 * 와일드카드 대신 이 호스트 하나만 허용합니다(next.config의 images.remotePatterns도 같은 함수를 씀).
 * 저장소가 연결되지 않은 환경에서는 null이고, 이미지 주소를 하나도 허용하지 않습니다. 서버에서만 부릅니다.
 */
export function blobPublicHost(storeId = process.env.BLOB_STORE_ID): string | null {
  const id = storeId
    ?.trim()
    .replace(/^store_/, "")
    .toLowerCase();
  return id && /^[a-z0-9]+$/.test(id) ? `${id}.public.blob.vercel-storage.com` : null;
}

/** 본문에 넣을 수 있는 이미지 주소인지: https, 이 배포의 Blob 공개 저장소 호스트, posts/ 경로. 서버에서만 부릅니다. */
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
    url.hostname === blobPublicHost() &&
    url.port === "" &&
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
