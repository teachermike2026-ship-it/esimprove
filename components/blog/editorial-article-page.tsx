import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getI18n } from "@/lib/i18n/server";
import { localeIntl } from "@/lib/i18n/config";
import { loadSeoSettings } from "@/lib/seo";
import { siteName } from "@/lib/config";
import { getDestinationBySlug, getPlansForDestination } from "@/lib/catalog";
import { destinationFacts } from "@/lib/destination-facts";
import { formatMoney } from "@/lib/money";
import { blogMetadata, blogUrl } from "@/lib/blog-seo";
import { editorialCard, editorialImageUrl, relatedEditorial } from "@/lib/blog-public";
import {
  EDITORIAL_AUTHOR,
  articleToc,
  articleWordCount,
  destinationGuideArticles,
  editorialCategoryName,
  plainInline,
  readingMinutes,
  type EditorialArticle,
} from "@/lib/editorial";
import { ArticleArt } from "@/components/blog/article-art";
import { BlogCardView } from "@/components/blog/blog-card";
import { EditorialBody, renderArticleInline } from "@/components/blog/editorial-article";

export async function editorialArticleMetadata(article: EditorialArticle): Promise<Metadata> {
  const image = editorialImageUrl(blogUrl("/"), article.slug);
  return blogMetadata({
    path: `/blog/${article.slug}`,
    title: article.seoTitle,
    absoluteTitle: true,
    description: article.description,
    openGraph: {
      type: "article",
      publishedTime: `${article.publishedAt}T00:00:00Z`,
      modifiedTime: `${article.updatedAt}T00:00:00Z`,
      authors: [EDITORIAL_AUTHOR],
      section: editorialCategoryName(article.category),
      tags: [article.primaryKeyword, ...article.secondaryKeywords],
      images: [{ url: image, width: 1200, height: 630, alt: article.art.alt }],
    },
    twitter: { images: [image] },
  });
}

function jsonLd(article: EditorialArticle, logoUrl: string): string {
  const url = blogUrl(`/blog/${article.slug}`);
  const organization = {
    "@type": "Organization",
    "@id": `${blogUrl("/")}#organization`,
    name: siteName,
    url: blogUrl("/"),
    ...(logoUrl ? { logo: { "@type": "ImageObject", url: logoUrl } } : {}),
  };
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: {
          "@type": "ImageObject",
          url: editorialImageUrl(blogUrl("/"), article.slug),
          width: 1200,
          height: 630,
          caption: article.art.alt,
        },
        datePublished: `${article.publishedAt}T00:00:00Z`,
        dateModified: `${article.updatedAt}T00:00:00Z`,
        inLanguage: "en",
        articleSection: editorialCategoryName(article.category),
        keywords: [article.primaryKeyword, ...article.secondaryKeywords].join(", "),
        wordCount: articleWordCount(article),
        timeRequired: `PT${readingMinutes(article)}M`,
        author: { "@type": "Organization", name: EDITORIAL_AUTHOR, url: blogUrl("/about") },
        publisher: organization,
        isPartOf: { "@type": "Blog", "@id": `${blogUrl("/blog")}#blog`, name: `${siteName} Blog` },
        citation: article.references.map((reference) => reference.url),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: blogUrl("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: blogUrl("/blog") },
          {
            "@type": "ListItem",
            position: 3,
            name: editorialCategoryName(article.category),
            item: blogUrl(`/blog/category/${article.category}`),
          },
          { "@type": "ListItem", position: 4, name: article.title, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: article.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: plainInline(item.a) },
        })),
      },
    ],
  }).replace(/</g, "\\u003c");
}

export async function EditorialArticlePage({ article }: { article: EditorialArticle }) {
  const { t, href, locale } = await getI18n();
  const db = await getDb();
  const settings = await loadSeoSettings(db).catch(() => null);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const dateFormat = new Intl.DateTimeFormat(localeIntl(locale), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const published = new Date(`${article.publishedAt}T00:00:00Z`);
  const updated = new Date(`${article.updatedAt}T00:00:00Z`);
  const toc = articleToc(article);
  const related = relatedEditorial(article, 3).map(editorialCard);
  const minutes = readingMinutes(article);
  const categoryName = editorialCategoryName(article.category);
  const guides = destinationGuideArticles().filter((item) => item.slug !== article.slug);

  // Live shop link for destination articles: price and plan count come from the catalog.
  const shop = await (async () => {
    const slug = article.destinations[0];
    if (!slug) return null;
    const row = await getDestinationBySlug(db, slug);
    if (!row) return null;
    const facts = destinationFacts(await getPlansForDestination(db, row.destination.id));
    return { slug: row.destination.slug, country: row.destination.name, facts };
  })().catch(() => null);
  const labels = {
    minRead: (value: number) => t("blog.minRead", { minutes: value }),
    formatDate: (date: Date) => dateFormat.format(date),
  };

  return (
    <div className="es-page blog-article-page">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: jsonLd(article, settings?.logoUrl ?? "") }} />

      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <Link href={href("/")}>{t("nav.home")}</Link>
        <span aria-hidden="true">/</span>
        <Link href={href("/blog")}>{t("blog.metaTitle")}</Link>
        <span aria-hidden="true">/</span>
        <Link href={href(`/blog/category/${article.category}`)}>{categoryName}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{article.title}</span>
      </nav>

      {locale !== "en" ? (
        <div className="callout section-tight">
          <p>{t("blog.translationPending")}</p>
        </div>
      ) : null}

      <article className="blog-editorial" lang="en" dir="ltr">
        <header className="blog-editorial-header">
          <p className="es-eyebrow">
            <Link href={href(`/blog/category/${article.category}`)}>{categoryName}</Link>
          </p>
          <h1>{article.title}</h1>
          <p className="es-page-lead">{article.excerpt}</p>
          <p className="blog-byline">
            <span>{t("blog.by", { author: EDITORIAL_AUTHOR })}</span>
            <span aria-hidden="true"> · </span>
            <time dateTime={published.toISOString()}>{t("blog.publishedOn", { date: dateFormat.format(published) })}</time>
            {updated.getTime() > published.getTime() ? (
              <>
                <span aria-hidden="true"> · </span>
                <time dateTime={updated.toISOString()}>{t("blog.updatedOn", { date: dateFormat.format(updated) })}</time>
              </>
            ) : null}
            <span aria-hidden="true"> · </span>
            <span>{labels.minRead(minutes)}</span>
          </p>
        </header>

        <figure className="blog-editorial-hero">
          <ArticleArt theme={article.art.theme} alt={article.art.alt} className="blog-editorial-art" />
        </figure>

        <div className="blog-editorial-layout">
          {toc.length > 2 ? (
            <nav className="blog-toc" aria-labelledby="toc-heading">
              <p id="toc-heading" className="blog-toc-title">
                {t("blog.onThisPage")}
              </p>
              <ol>
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
                <li>
                  <a href="#faq">{t("blog.faqTitle")}</a>
                </li>
              </ol>
            </nav>
          ) : null}

          <div className="blog-editorial-body">
            <section className="blog-answer" aria-labelledby="quick-answer">
              <h2 id="quick-answer" className="blog-answer-title">
                {t("blog.quickAnswer")}
              </h2>
              <p>{renderArticleInline(article.quickAnswer, href)}</p>
              {shop ? (
                <div className="blog-answer-shop">
                  <Link
                    className="es-button es-button-primary"
                    href={href(`/destinations/${shop.slug}`)}
                    data-track="blog_destination_clicked"
                  >
                    {t("blog.shopCta", { country: shop.country })}
                  </Link>
                  {shop.facts ? (
                    <span className="blog-answer-shop-meta">
                      {t("blog.shopFrom", {
                        count: shop.facts.planCount,
                        price: formatMoney(shop.facts.fromPriceMinor, shop.facts.currency),
                      })}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            <EditorialBody article={article} db={db} t={t} href={href} />

            <section className="blog-faq" aria-labelledby="faq">
              <h2 id="faq">{t("blog.faqTitle")}</h2>
              {article.faq.map((item) => (
                <details key={item.q} className="blog-faq-item">
                  <summary>{item.q}</summary>
                  <p>{renderArticleInline(item.a, href)}</p>
                </details>
              ))}
            </section>

            <section className="blog-references" aria-labelledby="references">
              <h2 id="references">{t("blog.references")}</h2>
              <ul>
                {article.references.map((reference) => (
                  <li key={reference.url}>
                    <a href={reference.url} target="_blank" rel="noopener noreferrer">
                      {reference.label}
                    </a>{" "}
                    <span className="muted">— {reference.publisher}</span>
                  </li>
                ))}
              </ul>
              <p className="blog-editorial-note">{t("blog.editorialNote", { author: EDITORIAL_AUTHOR })}</p>
            </section>
          </div>
        </div>
      </article>

      {guides.length > 0 ? (
        <nav className="es-page-section blog-guide-links" aria-labelledby="destination-guides-heading">
          <h2 id="destination-guides-heading" className="blog-guide-links-title">
            {t("blog.destinationGuides")}
          </h2>
          <ul lang="en">
            {guides.map((item) => (
              <li key={item.slug}>
                <Link href={href(`/blog/${item.slug}`)} data-track="related_article_clicked">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {related.length > 0 ? (
        <section className="es-page-section" aria-labelledby="related-heading">
          <div className="es-page-section-head">
            <p className="es-eyebrow">{t("blog.keepReading")}</p>
            <h2 id="related-heading">{t("blog.related")}</h2>
          </div>
          <div className="blog-grid">
            {related.map((card) => (
              <BlogCardView key={card.key} card={card} href={href} labels={labels} track="related_article_clicked" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
