import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAllCategories, listAllTags } from "@/lib/blog";
import { ArticleForm } from "../article-form";

export const metadata: Metadata = {
  title: "New article",
  robots: { index: false, follow: false },
};

export default async function NewArticlePage() {
  await requireAdmin("/admin/blog/new");
  const db = await getDb();
  const [categories, tags] = await Promise.all([listAllCategories(db), listAllTags(db)]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Content</p>
          <h1>New article</h1>
        </div>
        <Link href="/admin/blog" className="link-button">← Back to articles</Link>
      </div>
      <ArticleForm categories={categories} tags={tags} />
    </>
  );
}
