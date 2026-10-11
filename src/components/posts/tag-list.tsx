import Link from "next/link";

import { tagPath } from "@/lib/site";

// 글 행·카드는 제목 링크의 가상 요소로 전체를 덮으므로, 태그 링크를 그 위(z-10)에 올려 따로 누를 수 있게 합니다.
// 링크를 최소 44×44px로 두어 줄바꿈돼도 터치 영역이 겹치지 않게 합니다. 위쪽은 앞 내용(제목·요약)을 덮지 않도록 그대로 두고,
// 아래쪽만 음수 여백으로 행·카드의 안쪽 여백에 겹쳐 늘어나는 간격을 줄입니다.
export function TagList({ tags }: { tags: { slug: string; name: string }[] }) {
  if (tags.length === 0) return null;

  return (
    <ul
      aria-label="태그"
      className="-mb-3.5 flex flex-wrap gap-x-3 font-mono text-caption text-accent"
    >
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link
            href={tagPath(tag.slug)}
            className="relative z-10 inline-flex min-h-11 min-w-11 items-center hover:text-accent-hover"
          >
            #{tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
