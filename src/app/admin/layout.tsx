import type { Metadata } from "next";

// 관리자 화면은 공개 사이트의 머리글·바닥글 없이 그리고, 검색 결과에 나오지 않게 합니다.
// 세션을 읽는 부분은 각 페이지의 <Suspense> 안에 둡니다 (Cache Components).
export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | 관리자" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
