import Link from "next/link";

/** 404 안내 내용. 감싸는 머리글·<main>은 쓰는 곳(루트 not-found, (site) not-found)이 정합니다. */
export function NotFoundContent() {
  return (
    <div className="flex flex-col gap-4 pt-16 pb-16 md:pt-24">
      <p className="font-mono text-meta text-muted">
        <span className="text-accent">$</span> cd ./this-page
      </p>
      <h1 className="text-h1">페이지를 찾을 수 없습니다</h1>
      <p className="text-body text-muted">주소가 바뀌었거나 아직 공개되지 않은 글일 수 있습니다.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center font-mono text-meta text-accent hover:text-accent-hover"
      >
        ← 홈으로
      </Link>
    </div>
  );
}
