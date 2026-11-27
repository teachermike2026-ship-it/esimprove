import type { ArticleBlock, EditorialArticle } from "./types";
import { EDITORIAL_CATEGORIES, getEditorialCategory } from "./categories";
import { japanEsim } from "./articles/japan-esim";
import { europeEsim } from "./articles/europe-esim";
import { vietnamEsim } from "./articles/vietnam-esim";
import { thailandEsim } from "./articles/thailand-esim";
import { usaEsim } from "./articles/usa-esim";
import { turkeyEsim } from "./articles/turkey-esim";
import { howMuchData } from "./articles/how-much-data";
import { esimVsSimVsRoaming } from "./articles/esim-vs-sim-vs-roaming";
import { installEsim } from "./articles/install-esim";
import { whatsappEsim } from "./articles/whatsapp-esim";

export type { ArticleBlock, EditorialArticle } from "./types";
export { EDITORIAL_CATEGORIES, getEditorialCategory };

/** Newest first; ties keep this order (which is also the "featured" order). */
export const EDITORIAL_ARTICLES: EditorialArticle[] = [
  japanEsim,
  europeEsim,
  howMuchData,
  installEsim,
  vietnamEsim,
  thailandEsim,
  usaEsim,
  esimVsSimVsRoaming,
  turkeyEsim,
  whatsappEsim,
].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export const EDITORIAL_AUTHOR = "ESIMPROVE Editorial Team";
const WORDS_PER_MINUTE = 230;

export function getEditorialArticle(slug: string): EditorialArticle | undefined {
  return EDITORIAL_ARTICLES.find((article) => article.slug === slug);
}

export function isEditorialSlug(slug: string): boolean {
  return EDITORIAL_ARTICLES.some((article) => article.slug === slug);
}

/** Strips inline markup (`[label](href)`, `**bold**`, backticks) to plain text. */
export function plainInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function blockText(block: ArticleBlock): string[] {
  if (typeof block === "string") return [block];
  if ("h2" in block) return [block.h2];
  if ("h3" in block) return [block.h3];
  if ("ul" in block) return block.ul;
  if ("ol" in block) return block.ol;
  if ("tip" in block) return [block.tip];
  if ("note" in block) return [block.note];
  if ("table" in block) return [block.table.caption, ...block.table.head, ...block.table.rows.flat()];
  if ("cta" in block) return [block.cta.title, block.cta.body];
  return [];
}

/** All readable text of an article (for reading time, search and llms-full.txt). */
export function articlePlainText(article: EditorialArticle): string {
  const parts = [
    article.title,
    article.quickAnswer,
    ...article.body.flatMap(blockText),
    ...article.faq.flatMap((item) => [item.q, item.a]),
  ];
  return parts.map(plainInline).join("\n");
}

export function articleWordCount(article: EditorialArticle): number {
  return articlePlainText(article).split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(article: EditorialArticle): number {
  return Math.max(1, Math.round(articleWordCount(article) / WORDS_PER_MINUTE));
}

export function headingId(text: string): string {
  return plainInline(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** H2 table of contents. */
export function articleToc(article: EditorialArticle): { id: string; text: string }[] {
  return article.body
    .filter((block): block is { h2: string; id?: string } => typeof block !== "string" && "h2" in block)
    .map((block) => ({ id: block.id ?? headingId(block.h2), text: plainInline(block.h2) }));
}

/** Internal links (`/path`) used anywhere in the article. */
export function articleInternalLinks(article: EditorialArticle): string[] {
  const text = [
    article.quickAnswer,
    ...article.body.flatMap(blockText),
    ...article.body.flatMap((block) => (typeof block !== "string" && "cta" in block ? [`[x](${block.cta.href})`] : [])),
    ...article.faq.map((item) => item.a),
  ].join("\n");
  return [...text.matchAll(/\[[^\]]+\]\((\/[^)\s]*)\)/g)].map((match) => match[1]!.split("#")[0]!);
}

/** Old /guides slugs → new blog slugs (permanent redirects). */
export const SUPERSEDED_GUIDES: Record<string, string> = Object.fromEntries(
  EDITORIAL_ARTICLES.flatMap((article) => (article.supersedes ?? []).map((old) => [old, article.slug])),
);

export function editorialCategoryName(slug: string): string {
  return getEditorialCategory(slug)?.name ?? slug;
}

export function articleImagePath(slug: string): string {
  return `/og/blog/${slug}`;
}

/** Simple, accent-insensitive search over title, excerpt and keywords. */
export function matchesEditorialSearch(article: EditorialArticle, query: string): boolean {
  const normalise = (value: string) =>
    value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const haystack = normalise(
    [article.title, article.excerpt, article.primaryKeyword, ...article.secondaryKeywords, editorialCategoryName(article.category)].join(" "),
  );
  return normalise(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/** Editorial article written for a destination page (first match wins). */
export function editorialForDestination(slug: string): EditorialArticle | undefined {
  return EDITORIAL_ARTICLES.find((article) => article.destinations.includes(slug));
}

/** Editorial article written for a region page. */
export function editorialForRegion(slug: string): EditorialArticle | undefined {
  return EDITORIAL_ARTICLES.find((article) => article.regions?.includes(slug));
}

/** Fuller editorial article that a short /guides help page should point to. */
export function editorialForGuide(slug: string): EditorialArticle | undefined {
  return EDITORIAL_ARTICLES.find((article) => article.expands?.includes(slug));
}

/** Destination and regional guides, in a stable order, for cross-linking. */
export function destinationGuideArticles(): EditorialArticle[] {
  return EDITORIAL_ARTICLES.filter((article) => article.category === "destination-guides");
}

/** Categories with fewer published articles than this are `noindex, follow`. */
export const MIN_INDEXABLE_CATEGORY_ARTICLES = 2;
