import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// 공개 사이트 공통 레이아웃. 관리자 화면(/admin)은 이 머리글·바닥글 없이 자체 레이아웃을 씁니다.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-content flex-1 flex-col px-5 md:px-10">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
