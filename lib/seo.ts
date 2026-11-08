import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { seoSettings, blogArticles } from "@/lib/db/schema";
import { siteUrl } from "@/lib/config";

export type SeoSettings = {
  siteName: string;
  homepageTitle: string;
  homepageDescription: string;
  titleTemplate: string;
  canonicalBase: string;
  defaultOgImage: string;
  defaultOgTitle: string;
  defaultOgDescription: string;
  logoUrl: string;
  faviconUrl: string;
  organizationName: string;
  organizationUrl: string;
  organizationSameAs: string[];
  robotsDefault: string;
  indexDefault: boolean;
  gscVerificationToken: string | null;
  gscProperty: string;
  ga4MeasurementId: string;
  updatedAt: Date;
};

const DEFAULT_SETTINGS: SeoSettings = {
  siteName: "Esimprove",
  homepageTitle: "Esimprove — Travel eSIM",
  homepageDescription:
    "Instant travel data with eSIMs. Compare plans, stay connected everywhere.",
  titleTemplate: "{title} | {site_name}",
  canonicalBase: "",
  defaultOgImage: "",
  defaultOgTitle: "",
  defaultOgDescription: "",
  logoUrl: "",
  faviconUrl: "",
  organizationName: "",
  organizationUrl: "",
  organizationSameAs: [],
  robotsDefault: "index, follow",
  indexDefault: true,
  gscVerificationToken: null,
  gscProperty: "",
  ga4MeasurementId: "",
  updatedAt: new Date(),
};

export async function loadSeoSettings(db: Database): Promise<SeoSettings> {
  const row = await db
    .select()
    .from(seoSettings)
    .where(eq(seoSettings.id, "seo_global"))
    .limit(1);
  if (row.length === 0) return DEFAULT_SETTINGS;
  return {
    siteName: row[0].siteName,
    homepageTitle: row[0].homepageTitle,
    homepageDescription: row[0].homepageDescription,
    titleTemplate: row[0].titleTemplate,
    canonicalBase: row[0].canonicalBase,
    defaultOgImage: row[0].defaultOgImage,
    defaultOgTitle: row[0].defaultOgTitle,
    defaultOgDescription: row[0].defaultOgDescription,
    logoUrl: row[0].logoUrl,
    faviconUrl: row[0].faviconUrl,
    organizationName: row[0].organizationName,
    organizationUrl: row[0].organizationUrl,
    organizationSameAs: row[0].organizationSameAs ?? [],
    robotsDefault: row[0].robotsDefault,
    indexDefault: row[0].indexDefault,
    gscVerificationToken: row[0].gscVerificationToken ?? null,
    gscProperty: row[0].gscProperty,
    ga4MeasurementId: row[0].ga4MeasurementId,
    updatedAt: row[0].updatedAt,
  };
}

/** Backward-compatible alias used by the admin SEO page. */
export async function getSeoSettings(db: Database): Promise<SeoSettings> {
  return loadSeoSettings(db);
}

export type PageMetaInput = {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  robots?: string;
};

export type PageMeta = {
  title: string;
  description: string;
  canonical: string;
  og: { title: string; description: string; image: string };
  robots: string;
  jsonLd: string;
};

export function buildPageMeta(
  settings: SeoSettings,
  input: PageMetaInput,
): PageMeta {
  const title = (input.title || settings.homepageTitle).trim();
  const description = (input.description || settings.homepageDescription).trim();
  const canonical = input.canonical
    ? resolveAbsolute(input.canonical, settings.canonicalBase)
    : settings.canonicalBase;
  const ogTitle = (input.ogTitle || title).trim();
  const ogDescription = (input.ogDescription || description).trim();
  const ogImage = input.ogImage || settings.defaultOgImage;
  const robots = input.robots || settings.robotsDefault;

  return {
    title,
    description,
    canonical,
    og: { title: ogTitle, description: ogDescription, image: ogImage },
    robots,
    jsonLd: JSON.stringify(
      buildJsonLdGraph(settings, { title, description, canonical, ogImage }),
    ),
  };
}

function resolveAbsolute(value: string, base: string): string {
  try {
    return new URL(value, base || siteUrl).href;
  } catch {
    return value;
  }
}

function buildJsonLdGraph(
  settings: SeoSettings,
  page: {
    title: string;
    description: string;
    canonical: string;
    ogImage: string;
  },
) {
  const sameAs = settings.organizationSameAs?.filter(Boolean) ?? [];
  const graph: Record<string, unknown>[] = [];

  if (settings.siteName || settings.canonicalBase) {
    graph.push({
      "@type": "WebSite",
      ...(settings.siteName ? { name: settings.siteName } : {}),
      ...(settings.canonicalBase ? { url: settings.canonicalBase } : {}),
    });
  }

  graph.push({
    "@type": "WebPage",
    ...(page.title ? { name: page.title } : {}),
    ...(page.description ? { description: page.description } : {}),
    ...(page.canonical ? { url: page.canonical } : {}),
    ...(page.ogImage ? { image: page.ogImage } : {}),
  });

  if (settings.organizationName || settings.organizationUrl || sameAs.length) {
    graph.push({
      "@type": "Organization",
      ...(settings.organizationName ? { name: settings.organizationName } : {}),
      ...(settings.organizationUrl ? { url: settings.organizationUrl } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...(settings.logoUrl ? { logo: settings.logoUrl } : {}),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export type SeoHealth = {
  totalPages: number;
  publishedCount: number;
  draftCount: number;
  scheduledCount: number;
  missingTitle: number;
  missingDescription: number;
  duplicateTitles: number;
  duplicateDescriptions: number;
  missingCanonical: number;
  missingAlt: number;
  missingFeaturedImage: number;
  lastCheckedAt: Date;
  warnings: { type: string; count: number; hint: string }[];
};

export async function auditSeoHealth(db: Database): Promise<SeoHealth> {
  const rows = await db
    .select({
      slug: blogArticles.slug,
      title: blogArticles.title,
      excerpt: blogArticles.excerpt,
      status: blogArticles.status,
      featuredImage: blogArticles.featuredImage,
      featuredAlt: blogArticles.featuredAlt,
      canonicalUrl: blogArticles.canonicalUrl,
      seoTitle: blogArticles.seoTitle,
      seoDescription: blogArticles.seoDescription,
    })
    .from(blogArticles);

  const published = rows.filter((r) => r.status === "published");
  const draftCount = rows.filter((r) => r.status === "draft").length;
  const scheduledCount = rows.filter((r) => r.status === "scheduled").length;

  const titles = published.map((r) => (r.seoTitle || r.title).trim());
  const descriptions = published.map((r) => (r.seoDescription || r.excerpt).trim());
  const titleCounts = new Map<string, number>();
  const descCounts = new Map<string, number>();
  for (const t of titles) if (t) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
  for (const d of descriptions) if (d) descCounts.set(d, (descCounts.get(d) ?? 0) + 1);

  const missingTitle = titles.filter((t) => !t).length;
  const missingDescription = descriptions.filter((d) => !d).length;
  const duplicateTitles = [...titleCounts.values()].filter((n) => n > 1).length;
  const duplicateDescriptions = [...descCounts.values()].filter((n) => n > 1).length;
  const missingFeaturedImage = published.filter((r) => !r.featuredImage).length;
  const missingAlt = published.filter((r) => r.featuredImage && !r.featuredAlt.trim()).length;
  const missingCanonical = published.filter((r) => !r.canonicalUrl).length;

  const warnings: SeoHealth["warnings"] = [];
  if (missingTitle) warnings.push({ type: "Missing titles", count: missingTitle, hint: "Articles without an SEO title or title." });
  if (missingDescription) warnings.push({ type: "Missing descriptions", count: missingDescription, hint: "Articles without a meta description or excerpt." });
  if (duplicateTitles) warnings.push({ type: "Duplicate titles", count: duplicateTitles, hint: "Published articles sharing the same title." });
  if (duplicateDescriptions) warnings.push({ type: "Duplicate descriptions", count: duplicateDescriptions, hint: "Published articles sharing the same description." });
  if (missingAlt) warnings.push({ type: "Missing image alt text", count: missingAlt, hint: "Featured images without alt text." });
  if (missingCanonical) warnings.push({ type: "Missing canonical URLs", count: missingCanonical, hint: "Articles relying on the default canonical." });

  return {
    totalPages: rows.length,
    publishedCount: published.length,
    draftCount,
    scheduledCount,
    missingTitle,
    missingDescription,
    duplicateTitles,
    duplicateDescriptions,
    missingCanonical,
    missingAlt,
    missingFeaturedImage,
    lastCheckedAt: new Date(),
    warnings,
  };
}

/** Build site-level Organization + WebSite JSON-LD for the root layout. */
export function buildSiteJsonLd(settings: SeoSettings): string {
  const graph: Record<string, unknown>[] = [];
  if (settings.siteName || settings.canonicalBase) {
    graph.push({
      "@type": "WebSite",
      ...(settings.siteName ? { name: settings.siteName } : {}),
      ...(settings.canonicalBase ? { url: settings.canonicalBase } : {}),
    });
  }
  const sameAs = settings.organizationSameAs?.filter(Boolean) ?? [];
  if (settings.organizationName || settings.organizationUrl || sameAs.length) {
    graph.push({
      "@type": "Organization",
      ...(settings.organizationName ? { name: settings.organizationName } : {}),
      ...(settings.organizationUrl ? { url: settings.organizationUrl } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...(settings.logoUrl ? { logo: settings.logoUrl } : {}),
    });
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

/** Convert a stored title template into Next.js metadata template syntax. */
export function titleTemplateForNext(settings: SeoSettings): string {
  const template = settings.titleTemplate
    .replaceAll("{title}", "%s")
    .replaceAll("{site_name}", settings.siteName);
  return template.includes("%s") ? template : `%s · ${settings.siteName}`;
}

export type SeoSettingsInput = Omit<SeoSettings, "updatedAt">;

export async function saveSeoSettings(
  db: Database,
  values: SeoSettingsInput,
): Promise<void> {
  const record = {
    ...values,
    updatedAt: new Date(),
  };

  await db
    .insert(seoSettings)
    .values({ id: "seo_global", ...record })
    .onConflictDoUpdate({ target: seoSettings.id, set: record });
}

/** Absolute canonical base URL, preferring stored settings over env. */
export function canonicalBase(settings: SeoSettings): string {
  return settings.canonicalBase || siteUrl;
}

export function robotsTag(settings: SeoSettings): string {
  return settings.indexDefault ? settings.robotsDefault : "noindex, nofollow";
}

export function gscVerificationToken(settings: SeoSettings): string | null {
  return settings.gscVerificationToken;
}

export function ga4Id(settings: SeoSettings): string {
  return settings.ga4MeasurementId;
}

/** Build Article/Breadcrumb JSON-LD for a blog post. */
export function buildArticleJsonLd(
  settings: SeoSettings,
  input: {
    title: string;
    description: string;
    url: string;
    image?: string;
    publishedAt?: Date | null;
    updatedAt?: Date | null;
    authorName?: string;
  },
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    ...(input.image ? { image: [input.image] } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt.toISOString() } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt.toISOString() } : {}),
    ...(input.authorName ? { author: { "@type": "Person", name: input.authorName } } : {}),
    ...(settings.organizationName || settings.canonicalBase
      ? {
          publisher: {
            "@type": "Organization",
            ...(settings.organizationName ? { name: settings.organizationName } : {}),
            ...(settings.logoUrl
              ? { logo: { "@type": "ImageObject", url: settings.logoUrl } }
              : {}),
          },
        }
      : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
  });
}

/** Build BreadcrumbList JSON-LD. */
export function buildBreadcrumbJsonLd(
  crumbs: { name: string; url: string }[],
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  });
}
