import type { Metadata } from "next";

import { PostsPageView } from "@/components/posts/posts-page-view";
import { getPostsPage } from "@/lib/content/posts";

export const metadata: Metadata = {
  title: "모든 글",
};

export default async function PostsPage() {
  const { items, total, totalPages } = await getPostsPage(1);

  return <PostsPageView items={items} total={total} page={1} totalPages={totalPages} />;
}
