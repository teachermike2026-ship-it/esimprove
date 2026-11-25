import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listPublishedArticles, listCategoriesWithCounts } from "@/lib/blog";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { localeIntl } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { t } = await getI18n();
  const params = await searchParams;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const title = page > 1 ? `${t("blog.metaTitle")} — ${page}` : t("blog.metaTitle");
  return localizedMetadata({
    path: page > 1 ? `/blog?page=${page}` : "/blog",
    title,
    description: t("blog.metaDescription"),
  });
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, href, locale } = await getI18n();
  const params = await searchParams;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const db = await getDb();
  const [{ articles, total, pageCount }, categories] = await Promise.all([
    listPublishedArticles(db, { page, pageSize: PAGE_SIZE }),
    listCategoriesWithCounts(db),
  ]);
  const formatDate = (date: Date | null): string => {
    if (!date) return t("blog.unpublished");
    return new Intl.DateTimeFormat(localeIntl(locale), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const featured = page === 1 ? articles[0] : undefined;
  const rest = page === 1 ? articles.slice(1) : articles;

  return (
    <div className="es-page">
      <section className="es-page-hero">
        <p className="es-eyebrow">{t("blog.journalEyebrow")}</p>
        <h1>
          {t("blog.heroTitle")} <span className="es-green">{t("blog.heroAccent")}</span>
        </h1>
        <p className="es-page-lead">{t("blog.heroLead")}</p>
      </section>

      {locale !== "en" ? (
        <div className="callout section-tight">
          <p>{t("blog.contentNotice")}</p>
        </div>
      ) : null}

      {categories.length > 0 ? (
        <nav className="es-page-section" aria-label={t("blog.categoriesAria")}>
          <div className="chip-row">
            <Link href={href("/blog")} className="chip chip-active">
              {t("blog.allArticles")}
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={href(`/blog/category/${category.slug}`)}
                className="chip"
              >
                {category.name} ({category.articleCount})
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      {total === 0 ? (
        <section className="es-page-section">
          <div className="es-static-card">
            <h2>{t("blog.emptyTitle")}</h2>
            <p className="muted">{t("blog.emptyBody")}</p>
          </div>
        </section>
      ) : (
        <>
          {featured ? (
            <section className="es-page-section" aria-labelledby="featured-heading">
              <h2 id="featured-heading" className="visually-hidden">
                {t("blog.featured")}
              </h2>
              <article className="es-static-card blog-featured">
                {featured.featuredImage ? (
                  <img
                    src={featured.featuredImage}
                    alt={featured.featuredAlt || featured.title}
                    className="blog-card-image"
                    loading="eager"
                  />
                ) : null}
                <div className="blog-card-body">
                  {featured.categoryName ? (
                    <p className="es-eyebrow">{featured.categoryName}</p>
                  ) : null}
                  <h2>
                    <Link className="link" href={href(`/blog/${featured.slug}`)}>
                      {featured.title}
                    </Link>
                  </h2>
                  <p>{featured.excerpt}</p>
                  <p className="small muted">
                    {featured.authorName ? `${featured.authorName} · ` : ""}
                    <time dateTime={featured.publishedAt?.toISOString()}>
                      {formatDate(featured.publishedAt)}
                    </time>
                  </p>
                  <Link className="es-button es-button-primary" href={href(`/blog/${featured.slug}`)}>
                    {t("blog.readArticle")}
                  </Link>
                </div>
              </article>
            </section>
          ) : null}

          <section className="es-page-section" aria-labelledby="articles-heading">
            <div className="es-page-section-head">
              <p className="es-eyebrow">{t("blog.latest")}</p>
              <h2 id="articles-heading">{t("blog.allArticles")}</h2>
            </div>
            <div className="es-page-grid es-page-grid-3">
              {rest.map((article) => (
                <article key={article.id} className="es-static-card blog-card">
                  {article.featuredImage ? (
                    <img
                      src={article.featuredImage}
                      alt={article.featuredAlt || article.title}
                      className="blog-card-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="blog-card-image blog-card-placeholder" aria-hidden="true" />
                  )}
                  <div className="blog-card-body">
                    {article.categoryName ? (
                      <p className="es-eyebrow">{article.categoryName}</p>
                    ) : null}
                    <h3>
                      <Link className="link" href={href(`/blog/${article.slug}`)}>
                        {article.title}
                      </Link>
                    </h3>
                    <p>{article.excerpt}</p>
                    <p className="small muted">
                      <time dateTime={article.publishedAt?.toISOString()}>
                        {formatDate(article.publishedAt)}
                      </time>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            {pageCount > 1 ? (
              <nav className="pagination" aria-label={t("blog.pagesAria")}>
                {page > 1 ? (
                  <Link
                    className="page-link"
                    href={href(page === 2 ? "/blog" : `/blog?page=${page - 1}`)}
                    rel="prev"
                  >
                    {t("blog.previous")}
                  </Link>
                ) : null}
                <span className="small muted">
                  {t("blog.pageOf", { page, pageCount })}
                </span>
                {page < pageCount ? (
                  <Link className="page-link" href={href(`/blog?page=${page + 1}`)} rel="next">
                    {t("blog.next")}
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
