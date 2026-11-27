/**
 * Public blog listing: merges code-managed editorial articles
 * (lib/editorial) with articles published in the admin CMS (database).
 * Editorial slugs are reserved, so the two sources never collide.
 */
import type { Database } from "@/lib/db/client";
import { listAllPublishedArticles, listCategoriesWithCounts } from "@/lib/blog";
import {
  EDITORIAL_ARTICLES,
  EDITORIAL_AUTHOR,
  EDITORIAL_CATEGORIES,
  articleImagePath,
  editorialCategoryName,
  getEditorialArticle,
  matchesEditorialSearch,
  readingMinutes,
  type EditorialArticle,
} from "@/lib/editorial";
import type { ArtTheme } from "@/lib/editorial/types";

export interface BlogCard {
  key: string;
  source: "editorial" | "cms";
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: string | null;
  categoryName: string | null;
  publishedAt: Date;
  updatedAt: Date;
  readingMinutes: number;
  authorName: string | null;
  /** Editorial articles draw their thumbnail from a theme. */
  art: { theme: ArtTheme; alt: string } | null;
  /** CMS articles may have an uploaded image. */
  image: { src: string; alt: string } | null;
  featured: boolean;
  popular: boolean;
}

export interface BlogCategoryLink {
  slug: string;
  name: string;
  description: string;
  count: number;
}

export const BLOG_PAGE_SIZE = 9;

export function editorialCard(article: EditorialArticle): BlogCard {
  return {
    key: `e:${article.slug}`,
    source: "editorial",
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    categorySlug: article.category,
    categoryName: editorialCategoryName(article.category),
    publishedAt: new Date(`${article.publishedAt}T00:00:00Z`),
    updatedAt: new Date(`${article.updatedAt}T00:00:00Z`),
    readingMinutes: readingMinutes(article),
    authorName: EDITORIAL_AUTHOR,
    art: article.art,
    image: null,
    featured: Boolean(article.featured),
    popular: Boolean(article.popular),
  };
}

export function editorialImageUrl(base: string, slug: string): string {
  return `${base.replace(/\/+$/, "")}${articleImagePath(slug)}`;
}

async function cmsCards(db: Database): Promise<BlogCard[]> {
  const rows = await listAllPublishedArticles(db);
  return rows
    .filter((row) => !getEditorialArticle(row.slug))
    .map((row) => ({
      key: `c:${row.id}`,
      source: "cms" as const,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      categorySlug: row.categorySlug,
      categoryName: row.categoryName,
      publishedAt: row.publishedAt ?? row.createdAt,
      updatedAt: row.updatedAt,
      readingMinutes: Math.max(1, Math.round(row.bodyText.split(/\s+/).filter(Boolean).length / 230)),
      authorName: row.authorName,
      art: null,
      image: row.featuredImage ? { src: row.featuredImage, alt: row.featuredAlt || row.title } : null,
      featured: false,
      popular: false,
    }));
}

/** All public articles, newest first, optionally filtered by category or a search query. */
export async function listBlogCards(
  db: Database,
  options: { categorySlug?: string; query?: string } = {},
): Promise<BlogCard[]> {
  const query = options.query?.trim().slice(0, 100) ?? "";
  const editorial = EDITORIAL_ARTICLES.filter(
    (article) =>
      (!options.categorySlug || article.category === options.categorySlug) &&
      (!query || matchesEditorialSearch(article, query)),
  ).map(editorialCard);

  let cms: BlogCard[] = [];
  try {
    cms = (await cmsCards(db)).filter((card) => {
      if (options.categorySlug && card.categorySlug !== options.categorySlug) return false;
      if (!query) return true;
      const haystack = `${card.title} ${card.excerpt}`.toLowerCase();
      return query.toLowerCase().split(/\s+/).every((term) => haystack.includes(term));
    });
  } catch (error) {
    // The editorial blog must keep working if the CMS tables are unavailable.
    console.error("Blog CMS articles could not be loaded:", error instanceof Error ? error.message : error);
  }

  return [...editorial, ...cms].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || Number(b.featured) - Number(a.featured),
  );
}

export function paginate<T>(items: T[], page: number, pageSize = BLOG_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageCount,
    total: items.length,
  };
}

/** Editorial categories first, then CMS categories that have published articles. */
export async function listBlogCategories(db: Database): Promise<BlogCategoryLink[]> {
  const editorial = EDITORIAL_CATEGORIES.map((category) => ({
    slug: category.slug,
    name: category.name,
    description: category.description,
    count: EDITORIAL_ARTICLES.filter((article) => article.category === category.slug).length,
  }));
  let cms: BlogCategoryLink[] = [];
  try {
    cms = (await listCategoriesWithCounts(db))
      .filter((category) => Number(category.articleCount) > 0)
      .map((category) => ({
        slug: category.slug,
        name: category.name,
        description: category.description,
        count: Number(category.articleCount),
      }));
  } catch {
    cms = [];
  }
  const merged = new Map<string, BlogCategoryLink>();
  for (const category of editorial) merged.set(category.slug, category);
  for (const category of cms) {
    const existing = merged.get(category.slug);
    if (existing) existing.count += category.count;
    else merged.set(category.slug, category);
  }
  return [...merged.values()].filter((category) => category.count > 0);
}

/** Related editorial articles: the article's own picks first, then same category. */
export function relatedEditorial(article: EditorialArticle, limit = 3): EditorialArticle[] {
  const chosen: EditorialArticle[] = [];
  for (const slug of article.related) {
    const related = getEditorialArticle(slug);
    if (related && related.slug !== article.slug && !chosen.includes(related)) chosen.push(related);
  }
  for (const candidate of EDITORIAL_ARTICLES) {
    if (chosen.length >= limit) break;
    if (candidate.slug !== article.slug && candidate.category === article.category && !chosen.includes(candidate)) {
      chosen.push(candidate);
    }
  }
  return chosen.slice(0, limit);
}

export function featuredEditorial(): EditorialArticle {
  return EDITORIAL_ARTICLES.find((article) => article.featured) ?? EDITORIAL_ARTICLES[0]!;
}
