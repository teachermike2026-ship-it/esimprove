import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAllTags } from "@/lib/blog";
import { saveTagAction, deleteTagAction } from "../actions";

export const metadata: Metadata = {
  title: "Blog tags",
  robots: { index: false, follow: false },
};

export default async function BlogTagsPage() {
  await requireStaff("/admin/blog/tags", "blog");
  const db = await getDb();
  const tags = await listAllTags(db);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Tags</h1>
          <p className="muted">Tags provide cross-cutting article discovery.</p>
        </div>
        <Link href="/admin/blog" className="link-button">← Back to articles</Link>
      </div>

      <section className="card form section-tight">
        <h2>Add tag</h2>
        <form action={saveTagAction} className="inline-grid three">
          <div>
            <label htmlFor="tag-name">Name</label>
            <input id="tag-name" name="name" type="text" required maxLength={100} />
          </div>
          <div>
            <label htmlFor="tag-slug">Slug (optional)</label>
            <input id="tag-slug" name="slug" type="text" maxLength={100} />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary">Add tag</button>
          </div>
        </form>
      </section>

      <section className="card list section-tight">
        {tags.length === 0 ? (
          <p className="muted">No tags yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Slug</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id}>
                  <td>
                    <form action={saveTagAction} className="inline-form">
                      <input type="hidden" name="id" value={tag.id} />
                      <input name="name" defaultValue={tag.name} aria-label="Tag name" />
                      <input name="slug" defaultValue={tag.slug} aria-label="Tag slug" />
                      <button type="submit" className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                  <td className="small muted">{tag.slug}</td>
                  <td>
                    <form action={deleteTagAction}>
                      <input type="hidden" name="id" value={tag.id} />
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
