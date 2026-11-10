import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listBlogArticlesAdmin, listAllCategories, listAllTags } from "@/lib/blog";
import { deleteArticleAction, setArticleStatusAction } from "./actions";
import { formatDate } from "@/lib/money";

export const metadata: Metadata = {
  title: "Blog articles",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  scheduled: "Scheduled",
};

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("/admin/blog", "blog");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "all";
  const search = typeof params.search === "string" ? params.search : "";
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);

  const db = await getDb();
  const [{ articles }, categories, tags] = await Promise.all([
    listBlogArticlesAdmin(db, {
      status: status as "all" | "draft" | "published" | "scheduled",
      search,
      categoryId: categoryId || undefined,
    }),
    listAllCategories(db),
    listAllTags(db),
  ]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(articles.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = articles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function query(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (status !== "all") next.set("status", status);
    if (categoryId) next.set("categoryId", categoryId);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `/admin/blog?${next.toString()}`;
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Blog &amp; Articles</h1>
          <p className="muted">Create, edit, publish, and schedule articles. Only published articles appear publicly.</p>
        </div>
        <div className="row gap-8">
          <Link href="/blog" className="btn btn-secondary" target="_blank">View public blog</Link>
          <Link href="/admin/blog/new" className="btn btn-primary">+ New article</Link>
        </div>
      </div>

      <section className="card section-tight">
        <form method="get" className="toolbar">
          <input
            type="search"
            name="search"
            placeholder="Search by title, slug, or excerpt…"
            defaultValue={search}
            className="search"
          />
          <select name="status" defaultValue={status} aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <select name="categoryId" defaultValue={categoryId} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">Filter</button>
        </form>
      </section>

      <section className="card list section-tight">
        {paged.length === 0 ? (
          <p className="muted">No articles match these filters. <Link className="link" href="/admin/blog/new">Create the first article</Link>.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Category</th>
                <th>Author</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((article) => (
                <tr key={article.id}>
                  <td>
                    <Link className="link strong" href={`/admin/blog/${article.id}/edit`}>
                      {article.title || "(untitled)"}
                    </Link>
                    <div className="small muted">/{article.slug}</div>
                  </td>
                  <td><span className={`badge badge-${article.status}`}>{STATUS_LABELS[article.status] ?? article.status}</span></td>
                  <td className="small muted">{article.categoryName ?? "—"}</td>
                  <td className="small muted">{article.authorName ?? "—"}</td>
                  <td className="small muted">{formatDate(article.updatedAt)}</td>
                  <td>
                    <div className="row gap-8">
                      <Link href={`/admin/blog/${article.id}/edit`} className="link link-sm">Edit</Link>
                      {article.status === "published" ? (
                        <Link href={`/blog/${article.slug}`} className="link link-sm" target="_blank">View</Link>
                      ) : null}
                      <form action={setArticleStatusAction}>
                        <input type="hidden" name="id" value={article.id} />
                        <input type="hidden" name="status" value={article.status === "published" ? "draft" : "published"} />
                        <button className="btn btn-ghost btn-sm" type="submit">
                          {article.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                      <form action={deleteArticleAction}>
                        <input type="hidden" name="id" value={article.id} />
                        <button className="btn btn-ghost btn-sm" type="submit">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pageCount > 1 ? (
          <nav className="pagination" aria-label="Article pages">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <Link
                key={pageNumber}
                className={`page-link ${pageNumber === currentPage ? "page-active" : ""}`}
                href={query({ page: String(pageNumber) })}
              >
                {pageNumber}
              </Link>
            ))}
          </nav>
        ) : null}
      </section>

      <section className="card form section-tight">
        <div className="inline-grid three">
          <Link href="/admin/blog/categories" className="btn btn-secondary">Manage categories ({categories.length})</Link>
          <Link href="/admin/blog/tags" className="btn btn-secondary">Manage tags ({tags.length})</Link>
          <Link href="/admin/seo" className="btn btn-tertiary">SEO settings &amp; health →</Link>
        </div>
      </section>
    </>
  );
}
