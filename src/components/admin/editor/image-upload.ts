import { upload } from "@vercel/blob/client";

import {
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_PATH_PREFIX,
} from "@/lib/editor/image-policy";

/*
 * 본문 이미지 업로드(브라우저 → Vercel Blob 직접, ADR-0010). 토큰은 /api/admin/images가 관리자 확인 뒤 발급합니다.
 * 공개 페이지가 자리를 미리 잡을 수 있도록 올리기 전에 브라우저에서 원본 크기를 읽습니다.
 */

export type UploadedImage = { src: string; width: number; height: number };

export class ImageUploadError extends Error {}

/** 저장소 경로로 쓸 파일 이름. 영문 소문자·숫자·.-_만 남깁니다(한글 이름은 image로). */
function storageName(file: File) {
  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const base = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 60);
  return `${IMAGE_PATH_PREFIX}${base || "image"}.${ext}`;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  if (!IMAGE_CONTENT_TYPES.includes(file.type)) {
    throw new ImageUploadError("JPEG, PNG, WebP, AVIF 이미지만 올릴 수 있습니다.");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ImageUploadError(
      `${IMAGE_MAX_BYTES / 1024 / 1024}MB 이하의 이미지만 올릴 수 있습니다.`,
    );
  }

  let width: number;
  let height: number;
  try {
    // EXIF 회전을 반영한 크기입니다(공개 페이지의 최적화 결과도 회전을 반영합니다).
    const bitmap = await createImageBitmap(file);
    ({ width, height } = bitmap);
    bitmap.close();
  } catch {
    throw new ImageUploadError("이미지를 읽지 못했습니다. 파일이 손상되지 않았는지 확인하세요.");
  }
  if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
    throw new ImageUploadError(
      `가로·세로 ${IMAGE_MAX_DIMENSION}px 이하의 이미지만 올릴 수 있습니다.`,
    );
  }

  try {
    const blob = await upload(storageName(file), file, {
      access: "public",
      handleUploadUrl: "/api/admin/images",
      contentType: file.type,
    });
    return { src: blob.url, width, height };
  } catch (error) {
    throw new ImageUploadError(
      error instanceof Error && error.message
        ? `이미지를 올리지 못했습니다: ${error.message}`
        : "이미지를 올리지 못했습니다. 잠시 후 다시 시도하세요.",
    );
  }
}
