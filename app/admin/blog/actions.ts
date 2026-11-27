"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import {
  blogArticles,
  blogArticleTags,
  blogCategories,
  blogTags,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import {
  htmlToText,
  isValidSlug,
  normalizeSlug,
  sanitizeBlogHtml,
} from "@/lib/sanitize";
import { isEditorialSlug } from "@/lib/editorial";

export type BlogActionState = {
  ok?: boolean;
  error?: string;
  id?: string;
};

function str(formData: FormData, key: string, max = 2000): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function parseStatus(value: string): "draft" | "published" | "scheduled" {
  return value === "published" ? "published" : value === "scheduled" ? "scheduled" : "draft";
}

function parseTagIds(formData: FormData): string[] {
  return formData
    .getAll("tagIds")
    .map((value) => String(value))
    .filter(Boolean);
}

function revalidateBlog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  revalidatePath("/admin/seo");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
}

export async function saveArticleAction(
  _prev: BlogActionState,
  formData: FormData,
): Promise<BlogActionState> {
  const admin = await requireAdmin("/admin/blog");
  const db = await getDb();

  const id = str(formData, "id", 100) || null;
  const title = str(formData, "title", 200);
  const slugInput = str(formData, "slug", 150);
  const slug = normalizeSlug(slugInput || title);
  const excerpt = str(formData, "excerpt", 500);
  const bodyHtmlRaw = String(formData.get("bodyHtml") ?? "").slice(0, 200_000);
  const bodyHtml = sanitizeBlogHtml(bodyHtmlRaw);
  const bodyText = htmlToText(bodyHtml);
  const status = parseStatus(str(formData, "status", 20));
  const featuredImage = str(formData, "featuredImage", 500);
  const featuredAlt = str(formData, "featuredAlt", 300);
  const seoTitle = str(formData, "seoTitle", 200);
  const seoDescription = str(formData, "seoDescription", 300);
  const canonicalUrl = str(formData, "canonicalUrl", 500);
  const ogImage = str(formData, "ogImage", 500);
  const robots = str(formData, "robots", 50) || "index, follow";
  const categoryId = str(formData, "categoryId", 100) || null;
  const tagIds = parseTagIds(formData);
  const scheduledAtRaw = str(formData, "scheduledAt", 40);

  if (!title) return { error: "Title is required." };
  if (!slug || !isValidSlug(slug)) {
    return { error: "Slug is required and may only contain lowercase letters, numbers, and hyphens." };
  }
  if (isEditorialSlug(slug)) {
    return { error: `The slug "${slug}" is used by a built-in editorial article. Choose another slug.` };
  }
  if (!bodyHtml.trim()) return { error: "Article content is required." };
  if (featuredImage && !featuredAlt) {
    return { error: "Alt text is required when a featured image is set." };
  }
  if (canonicalUrl && !isHttpUrl(canonicalUrl)) {
    return { error: "Canonical URL must be an absolute http(s) URL." };
  }
  if (ogImage && !isHttpUrl(ogImage)) {
    return { error: "Open Graph image must be an absolute http(s) URL." };
  }
  let scheduledAt: Date | null = null;
  if (status === "scheduled") {
    if (!scheduledAtRaw) return { error: "A scheduled article requires a future publication date." };
    scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) return { error: "Invalid scheduled publication date." };
    if (scheduledAt.getTime() <= Date.now()) {
      return { error: "Scheduled publication must be in the future." };
    }
  }

  // Slug uniqueness check (exclude the article being edited).
  const existing = await db
    .select({ id: blogArticles.id })
    .from(blogArticles)
    .where(eq(blogArticles.slug, slug))
    .limit(1);
  if (existing.length > 0 && existing[0].id !== id) {
    return { error: `The slug "${slug}" is already in use.` };
  }

  const publishedAt = status === "published" ? new Date() : null;

  const common = {
    slug,
    title,
    excerpt,
    bodyHtml,
    bodyText,
    status,
    scheduledAt,
    categoryId,
    featuredImage,
    featuredAlt,
    seoTitle,
    seoDescription,
    canonicalUrl,
    ogImage,
    robots,
    updatedAt: new Date(),
  };

  let articleId = id;
  if (articleId) {
    const [existingArticle] = await db
      .select({ publishedAt: blogArticles.publishedAt })
      .from(blogArticles)
      .where(eq(blogArticles.id, articleId))
      .limit(1);
    if (!existingArticle) return { error: "Article not found." };
    await db
      .update(blogArticles)
      .set({
        ...common,
        publishedAt:
          status === "published"
            ? existingArticle.publishedAt ?? publishedAt
            : null,
      })
      .where(eq(blogArticles.id, articleId));
  } else {
    articleId = newId("art");
    await db.insert(blogArticles).values({
      id: articleId,
      ...common,
      publishedAt,
      authorId: admin.id,
      createdAt: new Date(),
    });
  }

  await db.delete(blogArticleTags).where(eq(blogArticleTags.articleId, articleId));
  const validTagIds: string[] = [];
  for (const tagId of tagIds) {
    const [tag] = await db.select({ id: blogTags.id }).from(blogTags).where(eq(blogTags.id, tagId)).limit(1);
    if (tag) validTagIds.push(tag.id);
  }
  if (validTagIds.length > 0) {
    await db.insert(blogArticleTags).values(
      validTagIds.map((tagId) => ({ articleId: articleId!, tagId })),
    );
  }

  revalidateBlog(slug);
  return { ok: true, id: articleId };
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const id = str(formData, "id", 100);
  if (!id) return;
  const db = await getDb();
  const [article] = await db
    .select({ slug: blogArticles.slug })
    .from(blogArticles)
    .where(eq(blogArticles.id, id))
    .limit(1);
  if (!article) return;
  await db.delete(blogArticles).where(eq(blogArticles.id, id));
  revalidateBlog(article.slug);
}

export async function setArticleStatusAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const id = str(formData, "id", 100);
  const target = parseStatus(str(formData, "status", 20));
  if (!id) return;
  const db = await getDb();
  const [article] = await db
    .select({ slug: blogArticles.slug, publishedAt: blogArticles.publishedAt })
    .from(blogArticles)
    .where(eq(blogArticles.id, id))
    .limit(1);
  if (!article) return;
  await db
    .update(blogArticles)
    .set({
      status: target,
      publishedAt: target === "published" ? article.publishedAt ?? new Date() : null,
      scheduledAt: target === "scheduled" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(blogArticles.id, id));
  revalidateBlog(article.slug);
}

export async function saveCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const db = await getDb();
  const id = str(formData, "id", 100);
  const name = str(formData, "name", 100);
  const slug = normalizeSlug(str(formData, "slug", 150) || name);
  const description = str(formData, "description", 500);
  const sortOrder = Number(str(formData, "sortOrder", 10) || "0");
  if (!name || !slug || !isValidSlug(slug)) return;

  const existing = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(eq(blogCategories.slug, slug))
    .limit(1);
  if (existing.length > 0 && existing[0].id !== id) return;

  if (id) {
    await db
      .update(blogCategories)
      .set({ name, slug, description, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0, updatedAt: new Date() })
      .where(eq(blogCategories.id, id));
  } else {
    await db.insert(blogCategories).values({
      id: newId("cat"),
      name,
      slug,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    });
  }
  revalidateBlog();
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const id = str(formData, "id", 100);
  if (!id) return;
  const db = await getDb();
  await db.delete(blogCategories).where(eq(blogCategories.id, id));
  revalidateBlog();
}

export async function saveTagAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const db = await getDb();
  const id = str(formData, "id", 100);
  const name = str(formData, "name", 100);
  const slug = normalizeSlug(str(formData, "slug", 150) || name);
  if (!name || !slug || !isValidSlug(slug)) return;

  const existing = await db
    .select({ id: blogTags.id })
    .from(blogTags)
    .where(eq(blogTags.slug, slug))
    .limit(1);
  if (existing.length > 0 && existing[0].id !== id) return;

  if (id) {
    await db.update(blogTags).set({ name, slug }).where(eq(blogTags.id, id));
  } else {
    await db.insert(blogTags).values({ id: newId("tag"), name, slug });
  }
  revalidateBlog();
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  await requireAdmin("/admin/blog");
  const id = str(formData, "id", 100);
  if (!id) return;
  const db = await getDb();
  await db.delete(blogTags).where(eq(blogTags.id, id));
  revalidateBlog();
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
