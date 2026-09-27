import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme-toggle";
import { breakpoints, colorTokens, radiusTokens, typeTokens } from "@/lib/design-tokens";

export const metadata: Metadata = {
  title: "디자인 토큰",
  robots: { index: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-b border-border py-10">
      <h2 className="font-mono text-meta text-accent">## {title}</h2>
      {children}
    </section>
  );
}

function Swatches({ theme }: { theme: "dark" | "light" }) {
  return (
    <div
      data-theme={theme}
      className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-bg p-5 md:grid-cols-4 lg:grid-cols-7"
    >
      {colorTokens.map((token) => (
        <div key={token.name} className="flex flex-col gap-2">
          <div className={`h-14 rounded-lg border border-border-strong ${token.swatch}`} />
          <div className="font-mono text-caption text-fg">{token.name}</div>
          <div className="text-caption text-muted">{token.usage}</div>
        </div>
      ))}
    </div>
  );
}

export default function DesignTokensPage() {
  return (
    <main className="mx-auto w-full max-w-content px-5 py-16 md:px-10">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-meta text-muted">
            <span className="text-accent">$</span> cat docs/DESIGN.md
          </p>
          <h1 className="text-h1">디자인 토큰</h1>
          <p className="text-body text-muted">
            값의 기준은 <code className="font-mono">src/app/globals.css</code>입니다. 오른쪽
            버튼으로 페이지 전체 테마를 바꿔 볼 수 있습니다.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Section title="색 · 다크">
        <Swatches theme="dark" />
      </Section>
      <Section title="색 · 라이트">
        <Swatches theme="light" />
      </Section>

      <Section title="글자 크기">
        <div className="flex flex-col">
          {typeTokens.map((token) => (
            <div
              key={token.name}
              className="grid grid-cols-1 items-baseline gap-2 border-b border-border py-3 md:grid-cols-[140px_minmax(0,1fr)]"
            >
              <span className="font-mono text-caption text-accent">text-{token.name}</span>
              <span className={token.className}>{token.sample}</span>
            </div>
          ))}
        </div>
        <p className="text-body text-muted">
          display, h1, h2, h3, body-lg는 화면 너비에 따라 크기가 연속으로 바뀝니다. 창 너비를 바꿔
          확인할 수 있습니다.
        </p>
      </Section>

      <Section title="모서리">
        <div className="flex flex-wrap gap-6">
          {radiusTokens.map((token) => (
            <div key={token.name} className="flex flex-col items-center gap-2">
              <div
                className={`size-18 border border-border-strong bg-surface ${token.className}`}
              />
              <span className="font-mono text-caption text-muted">
                {token.name} · {token.px}px
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="너비 구간">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {breakpoints.map((bp) => (
            <div key={bp.name} className="rounded-xl border border-border bg-surface px-5 py-4">
              <div className="font-mono text-caption text-muted">{bp.prefix}</div>
              <div className="text-body font-semibold">{bp.name}</div>
              <div className="font-mono text-meta text-accent">{bp.range}</div>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
