import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getI18n } from "@/lib/i18n/server";
import { localeIntl } from "@/lib/i18n/config";
import { blogMetadata, blogUrl } from "@/lib/blog-seo";
import {
  editorialCard,
  listBlogCards,
  listBlogCategories,
  paginate,
} from "@/lib/blog-public";
import { EDITORIAL_ARTICLES } from "@/lib/editorial";
import { siteName } from "@/lib/config";
import { BlogCardView } from "@/components/blog/blog-card";
import { BlogSearchForm } from "@/components/blog/blog-search-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParams(params: Record<string, string | string[] | undefined>) {
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  return { page, query };
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { t } = await getI18n();
  const { page, query } = readParams(await searchParams);
  const title = page > 1 ? `${t("blog.metaTitle")}: travel eSIM guides — page ${page}` : `Travel eSIM Guides & Insights | ${siteName} Blog`;
  // Out-of-range pages render the last page, so they must not be indexed as duplicates.
  const { pageCount } = paginate(await listBlogCards(await getDb(), {}), 1);
  return blogMetadata({
    path: page > 1 ? `/blog?page=${page}` : "/blog",
    title,
    absoluteTitle: page === 1,
    description:
      "Practical, source-checked travel eSIM guides: destination advice for Japan, Europe, Vietnam, Thailand, the USA and Turkey, data planning, installation and WhatsApp.",
    // Search result pages are useful for visitors but not for search engines.
    noindex: Boolean(query) || page > pageCount,
  });
}

export default async function BlogIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, href, locale } = await getI18n();
  const { page, query } = readParams(await searchParams);
  const db = await getDb();
  const [cards, categories] = await Promise.all([listBlogCards(db, { query }), listBlogCategories(db)]);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const dateFormat = new Intl.DateTimeFormat(localeIntl(locale), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const labels = {
    minRead: (minutes: number) => t("blog.minRead", { minutes }),
    formatDate: (date: Date) => dateFormat.format(date),
  };

  const browsing = !query && page === 1;
  const featured = browsing ? (cards.find((card) => card.featured) ?? cards[0]) : undefined;
  const essentials = browsing
    ? EDITORIAL_ARTICLES.filter((article) => article.popular && article.slug !== featured?.slug)
        .slice(0, 4)
        .map(editorialCard)
    : [];
  const listed = featured ? cards.filter((card) => card.key !== featured.key) : cards;
  const pageData = paginate(listed, page);

  const itemList = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${blogUrl("/blog")}#blog`,
    name: `${siteName} Blog`,
    url: blogUrl("/blog"),
    inLanguage: "en",
    publisher: { "@type": "Organization", name: siteName, url: blogUrl("/") },
    blogPost: cards.slice(0, 20).map((card) => ({
      "@type": "BlogPosting",
      headline: card.title,
      url: blogUrl(`/blog/${card.slug}`),
      datePublished: card.publishedAt.toISOString(),
      dateModified: card.updatedAt.toISOString(),
    })),
  });

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return href(qs ? `/blog?${qs}` : "/blog");
  };

  return (
    <div className="es-page blog-index">
      {browsing ? (
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: itemList }} />
      ) : null}

      <section className="es-page-hero blog-hero">
        <p className="es-eyebrow">{t("blog.journalEyebrow")}</p>
        <h1>
          {t("blog.heroTitle")} <span className="es-green">{t("blog.heroAccent")}</span>
        </h1>
        <p className="es-page-lead">{t("blog.heroLead")}</p>
        <BlogSearchForm
          query={query}
          action={href("/blog")}
          label={t("blog.searchLabel")}
          placeholder={t("blog.searchPlaceholder")}
          submit={t("blog.searchSubmit")}
        />
      </section>

      {locale !== "en" ? (
        <div className="callout section-tight">
          <p>{t("blog.contentNotice")}</p>
        </div>
      ) : null}

      <nav className="es-page-section blog-topics" aria-label={t("blog.categoriesAria")}>
        <p className="blog-topics-label">{t("blog.exploreTopics")}</p>
        <div className="chip-row">
          <Link href={href("/blog")} className={query ? "chip" : "chip chip-active"} aria-current={query ? undefined : "page"}>
            {t("blog.allArticles")}
          </Link>
          {categories.map((category) => (
            <Link key={category.slug} href={href(`/blog/category/${category.slug}`)} className="chip">
              {category.name} ({category.count})
            </Link>
          ))}
        </div>
      </nav>

      {query ? (
        <section className="es-page-section" aria-live="polite">
          <p className="blog-search-summary">
            {cards.length > 0
              ? t("blog.searchResults", { count: cards.length, query })
              : t("blog.noResults", { query })}{" "}
            <Link className="link" href={href("/blog")}>
              {t("blog.clearSearch")}
            </Link>
          </p>
        </section>
      ) : null}

      {featured ? (
        <section className="es-page-section" aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="visually-hidden">
            {t("blog.featured")}
          </h2>
          <BlogCardView card={featured} href={href} labels={labels} variant="featured" headingLevel={3} eager />
        </section>
      ) : null}

      {essentials.length > 0 ? (
        <section className="es-page-section" aria-labelledby="essentials-heading">
          <div className="es-page-section-head">
            <p className="es-eyebrow">{t("blog.essentials")}</p>
            <h2 id="essentials-heading">{t("blog.essentialsTitle")}</h2>
          </div>
          <ul className="blog-essentials">
            {essentials.map((card) => (
              <li key={card.key}>
                <Link href={href(`/blog/${card.slug}`)}>
                  <span className="blog-essentials-category">{card.categoryName}</span>
                  <strong>{card.title}</strong>
                  <span className="blog-essentials-meta">{labels.minRead(card.readingMinutes)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pageData.total > 0 ? (
        <section className="es-page-section" aria-labelledby="articles-heading">
          <div className="es-page-section-head">
            <p className="es-eyebrow">{t("blog.latest")}</p>
            <h2 id="articles-heading">{t("blog.allArticles")}</h2>
          </div>
          <div className="blog-grid">
            {pageData.items.map((card) => (
              <BlogCardView key={card.key} card={card} href={href} labels={labels} />
            ))}
          </div>

          {pageData.pageCount > 1 ? (
            <nav className="pagination" aria-label={t("blog.pagesAria")}>
              {pageData.page > 1 ? (
                <Link className="page-link" href={pageHref(pageData.page - 1)} rel="prev">
                  {t("blog.previous")}
                </Link>
              ) : null}
              <span className="small muted">{t("blog.pageOf", { page: pageData.page, pageCount: pageData.pageCount })}</span>
              {pageData.page < pageData.pageCount ? (
                <Link className="page-link" href={pageHref(pageData.page + 1)} rel="next">
                  {t("blog.next")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      ) : !query ? (
        <section className="es-page-section">
          <div className="es-static-card">
            <h2>{t("blog.emptyTitle")}</h2>
            <p className="muted">{t("blog.emptyBody")}</p>
          </div>
        </section>
      ) : null}

      <section className="es-page-section">
        <div className="blog-cta">
          <h2 className="blog-cta-title">{t("home.cta.title")} <span className="es-green">{t("home.cta.titleGreen")}</span></h2>
          <p>{t("home.cta.body")}</p>
          <Link className="es-button es-button-primary" href={href("/destinations")} data-track="cta_clicked">
            {t("home.cta.browseAll")}
          </Link>
        </div>
      </section>
    </div>
  );
}
