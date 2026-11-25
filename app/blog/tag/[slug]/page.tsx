import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getTagBySlug, listPublishedArticles } from "@/lib/blog";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { localeIntl } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { t } = await getI18n();
  const { slug } = await params;
  const db = await getDb();
  const tag = await getTagBySlug(db, slug);
  if (!tag) {
    return localizedMetadata({
      path: `/blog/tag/${slug}`,
      title: t("blog.tagNotFound"),
      robots: { index: false, follow: false },
    });
  }
  return localizedMetadata({
    path: `/blog/tag/${tag.slug}`,
    title: t("blog.articlesTagged", { tag: tag.name }),
    description: t("blog.browseTag", { tag: tag.name }),
  });
}

export default async function BlogTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, href, locale } = await getI18n();
  const { slug } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(typeof query.page === "string" ? query.page : "1") || 1);
  const db = await getDb();
  const tag = await getTagBySlug(db, slug);
  if (!tag) notFound();
  const { articles, total, pageCount } = await listPublishedArticles(db, {
    page,
    pageSize: 9,
    tagSlug: slug,
  });
  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    return new Intl.DateTimeFormat(localeIntl(locale), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="es-page">
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <Link href={href("/")}>{t("nav.home")}</Link>
        <span aria-hidden="true">/</span>
        <Link href={href("/blog")}>{t("blog.metaTitle")}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">#{tag.name}</span>
      </nav>

      <section className="es-page-hero">
        <p className="es-eyebrow">{t("blog.tagEyebrow")}</p>
        <h1>#{tag.name}</h1>
      </section>

      {locale !== "en" ? (
        <div className="callout section-tight">
          <p>{t("blog.contentNotice")}</p>
        </div>
      ) : null}

      {total === 0 ? (
        <section className="card section-tight">
          <p className="muted">{t("blog.noTagArticles")}</p>
        </section>
      ) : (
        <section className="es-page-section">
          <div className="es-page-grid es-page-grid-3">
            {articles.map((article) => (
              <article key={article.id} className="es-static-card blog-card">
                {article.featuredImage ? (
                  <img
                    src={article.featuredImage}
                    alt={article.featuredAlt || article.title}
                    className="blog-card-image"
                    loading="lazy"
                  />
                ) : null}
                <div className="blog-card-body">
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
            <nav className="pagination" aria-label={t("blog.tagPagesAria")}>
              {page > 1 ? (
                <Link className="page-link" href={href(`/blog/tag/${slug}?page=${page - 1}`)}>
                  {t("blog.previous")}
                </Link>
              ) : null}
              <span className="small muted">{t("blog.pageOf", { page, pageCount })}</span>
              {page < pageCount ? (
                <Link className="page-link" href={href(`/blog/tag/${slug}?page=${page + 1}`)}>
                  {t("blog.next")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
