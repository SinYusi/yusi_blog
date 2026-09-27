import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

// 1단계에서 실제 홈 화면으로 교체할 임시 페이지입니다.
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-1 flex-col px-5 md:px-10">
      <header className="flex items-center justify-between border-b border-border py-5">
        <span className="font-mono text-body font-bold">
          <span className="text-accent">~/</span>yusi_blog
        </span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-5 py-16">
        <p className="font-mono text-meta text-muted">
          <span className="text-accent">$</span> cat README.md
        </p>
        <h1 className="text-display">
          만들면서 부딪힌 문제를
          <br />
          <span className="text-accent">커밋처럼</span> 기록하는 프론트엔드 로그
        </h1>
        <p className="text-body-lg text-muted">블로그를 만드는 중입니다.</p>
        <Link href="/design" className="font-mono text-meta text-accent hover:text-accent-hover">
          ./design — 디자인 토큰 보기
        </Link>
      </main>
    </div>
  );
}
