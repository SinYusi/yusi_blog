import type { Metadata } from "next";

// 관리자 화면은 검색 결과에 나오지 않게 합니다. 세션을 읽는 부분은 각 페이지의 <Suspense> 안에 둡니다.
export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | 관리자" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex flex-1 flex-col pt-11 pb-16 md:pt-14">{children}</div>;
}
