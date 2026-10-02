import Link from "next/link";

import { signOut } from "@/auth";
import { NavLink } from "@/components/layout/nav-link";
import { requireAdmin } from "@/lib/auth/admin";

// 시리즈·태그 관리는 화면이 생길 때 추가합니다 (없는 페이지로 가는 링크를 두지 않음).
const ADMIN_NAV = [{ href: "/admin", label: "글" }] as const;

const itemClass =
  "flex min-h-11 items-center gap-2 rounded-lg px-4 text-body text-muted hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-fg";

function Icon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function AdminSidebar() {
  return (
    <aside className="flex flex-col gap-6 border-b border-border px-4 py-6 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:py-7">
      <div className="flex items-center gap-2 px-4">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center font-mono text-body font-bold"
        >
          <span className="text-accent">~/</span>yusi_blog
          <span aria-hidden="true" className="ml-2 inline-block h-4 w-2 bg-accent" />
        </Link>
        <span className="font-mono text-caption text-date">admin</span>
      </div>

      <nav aria-label="관리자 메뉴" className="flex flex-col gap-1">
        {ADMIN_NAV.map((item) => (
          <NavLink key={item.href} href={item.href} className={itemClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-col gap-1 lg:mt-auto">
        <Link href="/" className={itemClass}>
          <Icon d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" />
          블로그 보기
        </Link>
        <form
          action={async () => {
            "use server";
            await requireAdmin();
            await signOut({ redirectTo: "/admin/login" });
          }}
        >
          <button type="submit" className={`${itemClass} w-full cursor-pointer`}>
            <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
