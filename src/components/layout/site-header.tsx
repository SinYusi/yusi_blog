import Link from "next/link";

import { SearchDialog } from "@/components/search/search-dialog";
import { ThemeToggle } from "@/components/theme-toggle";

import { MobileMenu } from "./mobile-menu";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-content items-center justify-between px-5 py-2 md:px-10 md:py-4 lg:py-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-mono text-body font-bold lg:text-body-lg"
        >
          <span className="text-accent">~/</span>yusi_blog
          <span
            aria-hidden="true"
            className="ml-2 inline-block h-4 w-2 translate-y-0.5 bg-accent"
          />
        </Link>

        <div className="flex items-center gap-1 md:gap-6 lg:gap-8">
          <nav
            aria-label="주요 메뉴"
            className="hidden items-center gap-6 font-mono text-meta md:flex lg:gap-8"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center text-muted hover:text-fg aria-[current=page]:text-fg"
              >
                ./{item.label}
              </NavLink>
            ))}
          </nav>
          <SearchDialog />
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
