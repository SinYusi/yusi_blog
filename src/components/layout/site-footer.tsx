import { GITHUB_URL } from "./nav-items";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-content items-center justify-between px-5 py-6 font-mono text-caption text-muted md:px-10 md:py-8 md:text-meta">
        <span>© 2026 yusi_blog</span>
        <a href={GITHUB_URL} className="px-2 py-3 hover:text-fg">
          github
        </a>
      </div>
    </footer>
  );
}
