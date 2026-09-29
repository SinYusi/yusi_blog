// 태그 페이지가 생기면(3단계) 링크로 바꿉니다. 지금은 없는 페이지로 가는 링크를 두지 않습니다.
export function TagList({ tags }: { tags: { slug: string; name: string }[] }) {
  if (tags.length === 0) return null;

  return (
    <ul aria-label="태그" className="flex flex-wrap gap-x-3 font-mono text-caption text-accent">
      {tags.map((tag) => (
        <li key={tag.slug}>#{tag.name}</li>
      ))}
    </ul>
  );
}
