import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, JetBrains_Mono } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { DEFAULT_THEME, themeInitScript } from "@/lib/theme";

import "./globals.css";

const plexSansKr = IBM_Plex_Sans_KR({
  variable: "--font-plex-sans-kr",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  // 한글 폰트는 unicode-range로 수백 조각(굵기 4개 × 약 90개)으로 나뉩니다. preload를 켜면 페이지에 쓰이지 않는
  // 조각까지 모두 미리 받으므로(홈 기준 약 2.1MB), 끄고 브라우저가 필요한 조각만 받게 합니다.
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "yusi_blog",
    template: "%s | yusi_blog",
  },
  description: "만들면서 부딪힌 문제를 커밋처럼 기록하는 프론트엔드 로그",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      data-theme={DEFAULT_THEME}
      className={`${plexSansKr.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:text-bg"
        >
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto flex w-full max-w-content flex-1 flex-col px-5 md:px-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
