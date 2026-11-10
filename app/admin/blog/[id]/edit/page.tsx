import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getBlogArticleAdmin, listAllCategories, listAllTags } from "@/lib/blog";
import { ArticleForm } from "../../article-form";

export const metadata: Metadata = {
  title: "Edit article",
  robots: { index: false, follow: false },
};

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("/admin/blog", "blog");
  const { id } = await params;
  const db = await getDb();
  const [article, categories, tags] = await Promise.all([
    getBlogArticleAdmin(db, id),
    listAllCategories(db),
    listAllTags(db),
  ]);
  if (!article) notFound();

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Edit article</h1>
          <p className="muted">{article.title}</p>
        </div>
        <div className="row gap-8">
          {article.status === "published" ? (
            <Link href={`/blog/${article.slug}`} className="btn btn-secondary" target="_blank">View live</Link>
          ) : null}
          <Link href="/admin/blog" className="link-button">← Back to articles</Link>
        </div>
      </div>
      <ArticleForm article={article} categories={categories} tags={tags} />
    </>
  );
}
