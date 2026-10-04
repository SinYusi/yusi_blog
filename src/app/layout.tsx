import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, JetBrains_Mono } from "next/font/google";

import { FEED_PATH, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
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
  metadataBase: SITE_URL,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  twitter: { card: "summary" },
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
        {/* 하위 페이지의 alternates(canonical)가 레이아웃 값을 덮어쓰므로 피드 링크는 직접 둡니다. */}
        <link rel="alternate" type="application/rss+xml" title={SITE_NAME} href={FEED_PATH} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:text-bg"
        >
          본문으로 건너뛰기
        </a>
        {/* 공개 사이트는 (site) 레이아웃이, 관리자는 admin 레이아웃이 머리글과 <main id="main">을 둡니다. */}
        {children}
      </body>
    </html>
  );
}
