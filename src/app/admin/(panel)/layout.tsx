import { AdminSidebar } from "@/components/admin/admin-sidebar";

// 로그인 뒤 관리자 화면: 왼쪽 사이드바(데스크톱 --container-admin-sidebar, 240px) + 본문. 좁은 화면에서는 사이드바가 위로 올라갑니다.
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[var(--container-admin-sidebar)_minmax(0,1fr)]">
      <AdminSidebar />
      <main id="main" className="flex min-w-0 flex-col gap-7 px-5 py-8 md:px-12 md:py-10">
        {children}
      </main>
    </div>
  );
}
