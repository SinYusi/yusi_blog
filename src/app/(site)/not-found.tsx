import { NotFoundContent } from "@/components/layout/not-found-content";

// 공개 페이지에서 notFound()를 부를 때의 404. 머리글과 <main>은 (site) 레이아웃이 둡니다.
export default function SiteNotFound() {
  return <NotFoundContent />;
}
