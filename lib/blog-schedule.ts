import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { blogArticles } from "@/lib/db/schema";

/**
 * Promotes scheduled articles whose publication time has passed.
 *
 * There is no in-process scheduler: this is called by the protected internal
 * jobs endpoint, which Netlify can invoke with a scheduled function or an
 * external scheduler. Publishing is idempotent.
 */
export async function publishDueScheduledArticles(db: Database): Promise<{
  published: number;
  slugs: string[];
}> {
  const rows = await db
    .select({
      id: blogArticles.id,
      slug: blogArticles.slug,
      scheduledAt: blogArticles.scheduledAt,
    })
    .from(blogArticles)
    .where(eq(blogArticles.status, "scheduled"));

  const now = Date.now();
  const due = rows.filter((row) => row.scheduledAt && row.scheduledAt.getTime() <= now);
  for (const row of due) {
    await db
      .update(blogArticles)
      .set({
        status: "published",
        publishedAt: row.scheduledAt,
        scheduledAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(blogArticles.id, row.id), eq(blogArticles.status, "scheduled")));
  }
  return { published: due.length, slugs: due.map((row) => row.slug) };
}
