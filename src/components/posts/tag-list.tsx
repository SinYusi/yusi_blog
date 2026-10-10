import Link from "next/link";

import { tagPath } from "@/lib/site";

// 글 행·카드는 제목 링크의 가상 요소로 전체를 덮으므로, 태그 링크를 그 위(z-10)에 올려 따로 누를 수 있게 합니다.
// 줄 높이는 그대로 두고 가상 요소로 누를 수 있는 영역만 세로 44px까지 넓힙니다(가로는 태그 사이 간격 안에서).
export function TagList({ tags }: { tags: { slug: string; name: string }[] }) {
  if (tags.length === 0) return null;

  return (
    <ul aria-label="태그" className="flex flex-wrap gap-x-3 font-mono text-caption text-accent">
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link
            href={tagPath(tag.slug)}
            className="relative z-10 before:absolute before:-inset-x-1.5 before:-inset-y-3.5 hover:text-accent-hover"
          >
            #{tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
