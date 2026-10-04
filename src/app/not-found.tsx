import { NotFoundContent } from "@/components/layout/not-found-content";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/*
 * 어떤 라우트에도 맞지 않는 주소의 404. 루트 레이아웃에는 머리글이 없으므로 공개 사이트와 같은 머리글·바닥글을 직접 둡니다.
 * 공개 페이지 안에서 notFound()를 부르면 (site)/not-found.tsx가 (site) 레이아웃 안에서 그립니다.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-content flex-1 flex-col px-5 md:px-10">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
