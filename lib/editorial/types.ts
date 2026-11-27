/**
 * Editorial (code-managed) blog articles.
 *
 * Articles live in version control so they deploy with the code, can be
 * reviewed like any other change, and can embed *live* catalog data. Prices,
 * plan counts and networks are never typed into the prose: `catalog` and
 * `catalogGroup` blocks render them from the published catalog at request
 * time, so an article cannot drift out of date when supplier prices change.
 *
 * Articles written in the admin CMS (database) keep working alongside these;
 * see lib/blog-public.ts for how both sources are merged.
 *
 * Inline text supports `[label](/path)`, `[label](https://…)` and `**bold**`.
 */

export type ArticleBlock =
  | string
  | { h2: string; id?: string }
  | { h3: string }
  | { ul: string[] }
  | { ol: string[] }
  | { tip: string }
  | { note: string }
  | { table: { caption: string; head: string[]; rows: string[][] } }
  /** Live facts box for one destination slug (prices, networks, picks). */
  | { catalog: string }
  /** Live list of destinations whose name matches `match` (case-insensitive regex). */
  | { catalogGroup: { title: string; match: string; limit?: number } }
  | { cta: { title: string; body: string; href: string; label: string } };

export type SearchIntent = "informational" | "commercial investigation" | "transactional" | "how-to";

export type ArtTheme =
  | "japan"
  | "europe"
  | "vietnam"
  | "thailand"
  | "usa"
  | "turkey"
  | "data"
  | "compare"
  | "install"
  | "whatsapp";

export interface ArticleFaq {
  q: string;
  a: string;
}

export interface ArticleReference {
  label: string;
  publisher: string;
  url: string;
}

export interface EditorialArticle {
  slug: string;
  /** Visible H1. */
  title: string;
  /** <title>, ideally ≤ 60 characters. */
  seoTitle: string;
  /** Meta description, 110–160 characters. */
  description: string;
  /** Card and lead text. */
  excerpt: string;
  category: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  intent: SearchIntent;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  updatedAt: string;
  art: { theme: ArtTheme; alt: string };
  /** Two-to-four sentence direct answer shown at the top (answer engines). */
  quickAnswer: string;
  body: ArticleBlock[];
  faq: ArticleFaq[];
  references: ArticleReference[];
  /** Destination slugs this article sells into (CTA + analytics). */
  destinations: string[];
  related: string[];
  featured?: boolean;
  popular?: boolean;
  /** Old /guides slugs whose content this article replaces (301 redirects). */
  supersedes?: string[];
  /** Region slugs whose region page should link to this article. */
  regions?: string[];
  /** Short /guides help pages that should point readers to this fuller article. */
  expands?: string[];
}

export interface EditorialCategory {
  slug: string;
  name: string;
  description: string;
}
