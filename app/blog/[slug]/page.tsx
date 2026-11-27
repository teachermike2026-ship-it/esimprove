import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getPublishedArticleBySlug, getRelatedArticles } from "@/lib/blog";
import { loadSeoSettings, buildArticleJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";
import { noIndex, siteUrl } from "@/lib/config";
import { getI18n } from "@/lib/i18n/server";
import { localeIntl } from "@/lib/i18n/config";
import { getEditorialArticle } from "@/lib/editorial";
import { editorialArticleMetadata, EditorialArticlePage } from "@/components/blog/editorial-article-page";

export const dynamic = "force-dynamic";

function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const editorial = getEditorialArticle(slug);
  if (editorial) return editorialArticleMetadata(editorial);
  const db = await getDb();
  const article = await getPublishedArticleBySlug(db, slug);
  if (!article) notFound();

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  const canonical = article.canonicalUrl || `/blog/${article.slug}`;
  const image = article.ogImage || article.featuredImage;

  return {
    title,
    description,
    alternates: { canonical },
    robots: parseRobots(article.robots),
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      ...(image ? { images: [{ url: image, alt: article.featuredAlt || title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function parseRobots(value: string) {
  // Demo, preview and staging deployments are never indexable.
  if (noIndex) return { index: false, follow: false, nocache: true };
  const normalized = value.toLowerCase();
  return {
    index: !normalized.includes("noindex"),
    follow: !normalized.includes("nofollow"),
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { t, href, locale } = await getI18n();
  const { slug } = await params;
  const editorial = getEditorialArticle(slug);
  if (editorial) return <EditorialArticlePage article={editorial} />;
  const db = await getDb();
  const [article, settings] = await Promise.all([
    getPublishedArticleBySlug(db, slug),
    loadSeoSettings(db),
  ]);
  if (!article) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    return new Intl.DateTimeFormat(localeIntl(locale), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const related = await getRelatedArticles(db, article.id, article.categoryId, 3);
  const canonical = article.canonicalUrl || absoluteUrl(`/blog/${article.slug}`);
  const articleJsonLd = buildArticleJsonLd(settings, {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
    url: canonical,
    image: article.ogImage || article.featuredImage || undefined,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    authorName: article.authorName ?? undefined,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("nav.home"), url: siteUrl },
    { name: t("blog.metaTitle"), url: absoluteUrl("/blog") },
    ...(article.categoryName && article.categorySlug
      ? [{ name: article.categoryName, url: absoluteUrl(`/blog/category/${article.categorySlug}`) }]
      : []),
    { name: article.title, url: canonical },
  ]);

  return (
    <div className="es-page">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: articleJsonLd }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />

      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <Link href={href("/")}>{t("nav.home")}</Link>
        <span aria-hidden="true">/</span>
        <Link href={href("/blog")}>{t("blog.metaTitle")}</Link>
        {article.categoryName && article.categorySlug ? (
          <>
            <span aria-hidden="true">/</span>
            <Link href={href(`/blog/category/${article.categorySlug}`)}>{article.categoryName}</Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{article.title}</span>
      </nav>

      {locale !== "en" ? (
        <div className="callout section-tight">
          <p>{t("blog.contentNotice")}</p>
        </div>
      ) : null}

      <article className="blog-article">
        <header className="blog-article-header">
          {article.categoryName ? <p className="es-eyebrow">{article.categoryName}</p> : null}
          <h1>{article.title}</h1>
          {article.excerpt ? <p className="es-page-lead">{article.excerpt}</p> : null}
          <p className="small muted">
            {article.authorName ? <>{t("blog.by", { author: article.authorName })} · </> : null}
            {article.publishedAt ? (
              <time dateTime={article.publishedAt.toISOString()}>
                {formatDate(article.publishedAt)}
              </time>
            ) : null}
            {article.updatedAt.getTime() - (article.publishedAt?.getTime() ?? 0) > 86_400_000 ? (
              <>
                {" "}
                · {t("blog.updated")}{" "}
                <time dateTime={article.updatedAt.toISOString()}>
                  {formatDate(article.updatedAt)}
                </time>
              </>
            ) : null}
          </p>
        </header>

        {article.featuredImage ? (
          <img
            src={article.featuredImage}
            alt={article.featuredAlt || article.title}
            className="blog-article-image"
            loading="eager"
          />
        ) : null}

        <div
          className="blog-article-body"
          lang="en"
          dir="ltr"
          dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
        />

        {article.tags.length > 0 ? (
          <footer className="blog-article-tags">
            <p className="es-eyebrow">{t("blog.tags")}</p>
            <div className="chip-row">
              {article.tags.map((tag) => (
                <Link key={tag.id} className="chip" href={href(`/blog/tag/${tag.slug}`)}>
                  {tag.name}
                </Link>
              ))}
            </div>
          </footer>
        ) : null}

        <section className="card section-tight" aria-labelledby="share-heading">
          <h2 id="share-heading">{t("blog.shareTitle")}</h2>
          <div className="row gap-8">
            <a
              className="chip"
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(article.title)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("blog.shareX")}
            </a>
            <a
              className="chip"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("blog.shareLinkedIn")}
            </a>
            <a
              className="chip"
              href={`mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(canonical)}`}
            >
              {t("blog.shareEmail")}
            </a>
          </div>
        </section>
      </article>

      {related.length > 0 ? (
        <section className="es-page-section" aria-labelledby="related-heading">
          <div className="es-page-section-head">
            <p className="es-eyebrow">{t("blog.keepReading")}</p>
            <h2 id="related-heading">{t("blog.related")}</h2>
          </div>
          <div className="es-page-grid es-page-grid-3">
            {related.map((item) => (
              <article key={item.id} className="es-static-card blog-card">
                {item.featuredImage ? (
                  <img
                    src={item.featuredImage}
                    alt={item.featuredAlt || item.title}
                    className="blog-card-image"
                    loading="lazy"
                  />
                ) : null}
                <div className="blog-card-body">
                  <h3>
                    <Link className="link" href={href(`/blog/${item.slug}`)}>
                      {item.title}
                    </Link>
                  </h3>
                  <p>{item.excerpt}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
