import { renderOgImage } from "@/lib/og";
import { SITE_DESCRIPTION } from "@/lib/site";

/*
 * 사이트 공용 Open Graph 이미지(SITE_OG_IMAGE). 글 상세를 뺀 공개 페이지가 pageMetadata로 가리킵니다.
 * 파일 규칙(opengraph-image)으로 두면 openGraph를 따로 지정하는 하위 페이지에는 이어지지 않아 고정 주소로 둡니다.
 * 폰트 읽기가 캐시되므로 빌드 시 정적 응답으로 생성됩니다.
 */
export function GET() {
  return renderOgImage({ eyebrow: "cat README.md", title: SITE_DESCRIPTION });
}
