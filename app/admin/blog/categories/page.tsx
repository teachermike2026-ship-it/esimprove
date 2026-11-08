import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAllCategories } from "@/lib/blog";
import { saveCategoryAction, deleteCategoryAction } from "../actions";

export const metadata: Metadata = {
  title: "Blog categories",
  robots: { index: false, follow: false },
};

export default async function BlogCategoriesPage() {
  await requireAdmin("/admin/blog/categories");
  const db = await getDb();
  const categories = await listAllCategories(db);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Categories</h1>
          <p className="muted">Categories group articles and provide public category pages.</p>
        </div>
        <Link href="/admin/blog" className="link-button">← Back to articles</Link>
      </div>

      <section className="card form section-tight">
        <h2>Add category</h2>
        <form action={saveCategoryAction} className="inline-grid three">
          <div>
            <label htmlFor="category-name">Name</label>
            <input id="category-name" name="name" type="text" required maxLength={100} />
          </div>
          <div>
            <label htmlFor="category-slug">Slug (optional)</label>
            <input id="category-slug" name="slug" type="text" maxLength={100} />
          </div>
          <div>
            <label htmlFor="category-sortOrder">Sort order</label>
            <input id="category-sortOrder" name="sortOrder" type="number" defaultValue={0} />
          </div>
          <div>
            <label htmlFor="category-description">Description</label>
            <textarea id="category-description" name="description" rows={2} maxLength={500} />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary">Add category</button>
          </div>
        </form>
      </section>

      <section className="card list section-tight">
        {categories.length === 0 ? (
          <p className="muted">No categories yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Slug</th><th>Order</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <form action={saveCategoryAction} className="inline-form">
                      <input type="hidden" name="id" value={category.id} />
                      <input name="name" defaultValue={category.name} aria-label="Category name" />
                      <input name="slug" defaultValue={category.slug} aria-label="Category slug" />
                      <input name="sortOrder" type="number" defaultValue={category.sortOrder} aria-label="Sort order" />
                      <button type="submit" className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                  <td className="small muted">{category.slug}</td>
                  <td className="small muted">{category.sortOrder}</td>
                  <td>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
