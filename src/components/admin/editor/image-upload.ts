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

/**
 * 파일 앞부분(매직 바이트)으로 이미지 형식을 판별합니다. 브라우저가 형식을 알려 주지 않은 파일(type이 빈 문자열)에 씁니다.
 * JPEG(FF D8 FF), PNG(89 50 4E 47), WebP(RIFF....WEBP), AVIF(....ftypavif / ftypavis)만 알아봅니다.
 */
async function sniffImageType(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

/** 저장소 경로로 쓸 파일 이름. 영문 소문자·숫자·.-_만 남깁니다(한글 이름은 image로). */
function storageName(file: File, type: string) {
  const ext = type === "image/jpeg" ? "jpg" : type.split("/")[1];
  const base = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 60);
  return `${IMAGE_PATH_PREFIX}${base || "image"}.${ext}`;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  // 브라우저가 알려 준 형식이 없으면 파일 앞부분으로 판별해, 그 형식을 확장자·업로드 형식에 함께 씁니다.
  const type = file.type || (await sniffImageType(file)) || "";
  if (!IMAGE_CONTENT_TYPES.includes(type)) {
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
    const blob = await upload(storageName(file, type), file, {
      access: "public",
      handleUploadUrl: "/api/admin/images",
      contentType: type,
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
