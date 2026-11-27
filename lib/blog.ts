import { and, asc, desc, eq, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  blogArticles,
  blogArticleTags,
  blogCategories,
  blogTags,
  users,
} from "@/lib/db/schema";

export type BlogArticleWithRelations = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  bodyText: string;
  status: string;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  authorId: string;
  authorName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  featuredImage: string;
  featuredAlt: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robots: string;
  createdAt: Date;
  updatedAt: Date;
  tags: { id: string; slug: string; name: string }[];
};

export type BlogListFilter = {
  search?: string;
  status?: "all" | "draft" | "published" | "scheduled";
  categoryId?: string;
  tagId?: string;
  page?: number;
  pageSize?: number;
  includeScheduledOnly?: boolean;
};

const PUBLIC_PAGE_SIZE = 9;

function mapArticle(row: {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  bodyText: string;
  status: string;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  authorId: string;
  categoryId: string | null;
  featuredImage: string;
  featuredAlt: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogImage: string;
  robots: string;
  createdAt: Date;
  updatedAt: Date;
  authorName?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
}): BlogArticleWithRelations {
  return {
    ...row,
    authorName: row.authorName ?? null,
    categoryName: row.categoryName ?? null,
    categorySlug: row.categorySlug ?? null,
    tags: [],
  };
}

async function attachTags(
  db: Database,
  articles: BlogArticleWithRelations[],
): Promise<BlogArticleWithRelations[]> {
  if (articles.length === 0) return articles;
  const rows = await db
    .select({
      articleId: blogArticleTags.articleId,
      id: blogTags.id,
      slug: blogTags.slug,
      name: blogTags.name,
    })
    .from(blogArticleTags)
    .innerJoin(blogTags, eq(blogArticleTags.tagId, blogTags.id))
    .where(inArray(blogArticleTags.articleId, articles.map((article) => article.id)));

  const byArticle = new Map<string, { id: string; slug: string; name: string }[]>();
  for (const row of rows) {
    const list = byArticle.get(row.articleId) ?? [];
    list.push({ id: row.id, slug: row.slug, name: row.name });
    byArticle.set(row.articleId, list);
  }
  return articles.map((article) => ({ ...article, tags: byArticle.get(article.id) ?? [] }));
}

const articleSelect = {
  id: blogArticles.id,
  slug: blogArticles.slug,
  title: blogArticles.title,
  excerpt: blogArticles.excerpt,
  bodyHtml: blogArticles.bodyHtml,
  bodyText: blogArticles.bodyText,
  status: blogArticles.status,
  publishedAt: blogArticles.publishedAt,
  scheduledAt: blogArticles.scheduledAt,
  authorId: blogArticles.authorId,
  categoryId: blogArticles.categoryId,
  featuredImage: blogArticles.featuredImage,
  featuredAlt: blogArticles.featuredAlt,
  seoTitle: blogArticles.seoTitle,
  seoDescription: blogArticles.seoDescription,
  canonicalUrl: blogArticles.canonicalUrl,
  ogImage: blogArticles.ogImage,
  robots: blogArticles.robots,
  createdAt: blogArticles.createdAt,
  updatedAt: blogArticles.updatedAt,
  authorName: users.name,
  categoryName: blogCategories.name,
  categorySlug: blogCategories.slug,
};

export async function listBlogArticlesAdmin(
  db: Database,
  filter: BlogListFilter = {},
): Promise<{ articles: BlogArticleWithRelations[]; total: number }> {
  const conditions = [];
  if (filter.status && filter.status !== "all") {
    conditions.push(eq(blogArticles.status, filter.status));
  }
  if (filter.search) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(blogArticles.title, term),
        ilike(blogArticles.slug, term),
        ilike(blogArticles.excerpt, term),
      )!,
    );
  }
  if (filter.categoryId) conditions.push(eq(blogArticles.categoryId, filter.categoryId));

  let tagArticleIds: string[] | null = null;
  if (filter.tagId) {
    const rows = await db
      .select({ articleId: blogArticleTags.articleId })
      .from(blogArticleTags)
      .where(eq(blogArticleTags.tagId, filter.tagId));
    tagArticleIds = rows.map((row) => row.articleId);
    if (tagArticleIds.length === 0) return { articles: [], total: 0 };
    conditions.push(inArray(blogArticles.id, tagArticleIds));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select(articleSelect)
    .from(blogArticles)
    .leftJoin(users, eq(blogArticles.authorId, users.id))
    .leftJoin(blogCategories, eq(blogArticles.categoryId, blogCategories.id))
    .where(where)
    .orderBy(desc(blogArticles.updatedAt));

  const withTags = await attachTags(db, rows.map((row) => mapArticle(row)));
  return { articles: withTags, total: withTags.length };
}

export async function getBlogArticleAdmin(
  db: Database,
  id: string,
): Promise<BlogArticleWithRelations | null> {
  const rows = await db
    .select(articleSelect)
    .from(blogArticles)
    .leftJoin(users, eq(blogArticles.authorId, users.id))
    .leftJoin(blogCategories, eq(blogArticles.categoryId, blogCategories.id))
    .where(eq(blogArticles.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const [withTags] = await attachTags(db, [mapArticle(rows[0])]);
  return withTags;
}

/** Public published articles only; scheduled articles are published by cron. */
export async function listPublishedArticles(
  db: Database,
  options: { page?: number; pageSize?: number; categorySlug?: string; tagSlug?: string } = {},
): Promise<{ articles: BlogArticleWithRelations[]; total: number; page: number; pageCount: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, options.pageSize ?? PUBLIC_PAGE_SIZE));
  const conditions = [
    eq(blogArticles.status, "published"),
    isNotNull(blogArticles.publishedAt),
    lte(blogArticles.publishedAt, new Date()),
  ];
  if (options.categorySlug) conditions.push(eq(blogCategories.slug, options.categorySlug));
  if (options.tagSlug) {
    const tagRows = await db
      .select({ articleId: blogArticleTags.articleId })
      .from(blogArticleTags)
      .innerJoin(blogTags, eq(blogArticleTags.tagId, blogTags.id))
      .where(eq(blogTags.slug, options.tagSlug));
    const ids = tagRows.map((row) => row.articleId);
    if (ids.length === 0) return { articles: [], total: 0, page, pageCount: 0 };
    conditions.push(inArray(blogArticles.id, ids));
  }
  const where = and(...conditions);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(blogArticles)
    .leftJoin(blogCategories, eq(blogArticles.categoryId, blogCategories.id))
    .where(where);
  const total = Number(countRows[0]?.count ?? 0);

  const rows = await db
    .select(articleSelect)
    .from(blogArticles)
    .leftJoin(users, eq(blogArticles.authorId, users.id))
    .leftJoin(blogCategories, eq(blogArticles.categoryId, blogCategories.id))
    .where(where)
    .orderBy(desc(blogArticles.publishedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const articles = await attachTags(db, rows.map((row) => mapArticle(row)));
  return { articles, total, page, pageCount: Math.ceil(total / pageSize) };
}

export async function getPublishedArticleBySlug(
  db: Database,
  slug: string,
): Promise<BlogArticleWithRelations | null> {
  const rows = await db
    .select(articleSelect)
    .from(blogArticles)
    .leftJoin(users, eq(blogArticles.authorId, users.id))
    .leftJoin(blogCategories, eq(blogArticles.categoryId, blogCategories.id))
    .where(
      and(
        eq(blogArticles.slug, slug),
        eq(blogArticles.status, "published"),
        isNotNull(blogArticles.publishedAt),
        lte(blogArticles.publishedAt, new Date()),
      ),
    )
    .limit(1);
  if (rows.length === 0) return null;
  const [article] = await attachTags(db, [mapArticle(rows[0])]);
  return article;
}

export async function getRelatedArticles(
  db: Database,
  articleId: string,
  categoryId: string | null,
  limit = 3,
): Promise<BlogArticleWithRelations[]> {
  const conditions = [
    eq(blogArticles.status, "published"),
    isNotNull(blogArticles.publishedAt),
    lte(blogArticles.publishedAt, new Date()),
  ];
  if (categoryId) conditions.push(eq(blogArticles.categoryId, categoryId));
  const rows = await db
    .select(articleSelect)
    .from(blogArticles)
    .leftJoin(users, eq(blogArticles.authorId, users.id))
    .leftJoin(blogCategories, eq(blogArticles.categoryId, blogCategories.id))
    .where(and(...conditions))
    .orderBy(desc(blogArticles.publishedAt))
    .limit(limit + 1);
  const filtered = rows.filter((row) => row.id !== articleId).slice(0, limit);
  return attachTags(db, filtered.map((row) => mapArticle(row)));
}

export async function listCategoriesWithCounts(db: Database) {
  return db
    .select({
      id: blogCategories.id,
      slug: blogCategories.slug,
      name: blogCategories.name,
      description: blogCategories.description,
      sortOrder: blogCategories.sortOrder,
      articleCount: sql<number>`count(${blogArticles.id})::int`,
    })
    .from(blogCategories)
    .leftJoin(
      blogArticles,
      and(eq(blogArticles.categoryId, blogCategories.id), eq(blogArticles.status, "published")),
    )
    .groupBy(blogCategories.id, blogCategories.slug, blogCategories.name, blogCategories.description, blogCategories.sortOrder)
    .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name));
}

export async function listAllCategories(db: Database) {
  return db
    .select()
    .from(blogCategories)
    .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name));
}

export async function listAllTags(db: Database) {
  return db.select().from(blogTags).orderBy(asc(blogTags.name));
}

export async function getCategoryBySlug(db: Database, slug: string) {
  const [row] = await db
    .select()
    .from(blogCategories)
    .where(eq(blogCategories.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getTagBySlug(db: Database, slug: string) {
  const [row] = await db.select().from(blogTags).where(eq(blogTags.slug, slug)).limit(1);
  return row ?? null;
}

/** Every published CMS article (no pagination), newest first. */
export async function listAllPublishedArticles(db: Database): Promise<BlogArticleWithRelations[]> {
  const rows = await db
    .select(articleSelect)
    .from(blogArticles)
    .leftJoin(users, eq(blogArticles.authorId, users.id))
    .leftJoin(blogCategories, eq(blogArticles.categoryId, blogCategories.id))
    .where(
      and(
        eq(blogArticles.status, "published"),
        isNotNull(blogArticles.publishedAt),
        lte(blogArticles.publishedAt, new Date()),
      ),
    )
    .orderBy(desc(blogArticles.publishedAt))
    .limit(1000);
  return rows.map((row) => mapArticle(row));
}
