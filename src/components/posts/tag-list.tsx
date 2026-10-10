import Link from "next/link";

import { tagPath } from "@/lib/site";

// 글 행·카드는 제목 링크의 가상 요소로 전체를 덮으므로, 태그 링크를 그 위(z-10)에 올려 따로 누를 수 있게 합니다.
// 링크 높이를 44px로 두어 줄바꿈돼도 터치 영역이 겹치지 않게 하고, 목록의 음수 여백으로 보이는 간격은 그대로 둡니다.
export function TagList({ tags }: { tags: { slug: string; name: string }[] }) {
  if (tags.length === 0) return null;

  return (
    <ul
      aria-label="태그"
      className="-my-3.5 flex flex-wrap gap-x-3 font-mono text-caption text-accent"
    >
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link
            href={tagPath(tag.slug)}
            className="relative z-10 inline-flex min-h-11 items-center hover:text-accent-hover"
          >
            #{tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
