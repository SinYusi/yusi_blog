import type { Metadata } from "next";

import { PostsPageView } from "@/components/posts/posts-page-view";
import { getPostsPage } from "@/lib/content/posts";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: "모든 글", path: "/posts" });

export default async function PostsPage() {
  const { items, total, totalPages } = await getPostsPage(1);

  return <PostsPageView items={items} total={total} page={1} totalPages={totalPages} />;
}
