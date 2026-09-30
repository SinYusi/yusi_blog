"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 현재 경로면 aria-current="page"를 붙입니다. 스타일은 aria-[current=page]: 변형으로 지정합니다. */
export function NavLink({
  href,
  className,
  onNavigate,
  children,
}: {
  href: string;
  className: string;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={className}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}
