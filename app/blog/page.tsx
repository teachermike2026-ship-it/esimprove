import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listPublishedArticles, listCategoriesWithCounts } from "@/lib/blog";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const title = page > 1 ? `Blog — page ${page}` : "Blog";
  return {
    title,
    description:
      "Guides, destination tips, and practical travel connectivity advice from Esimprove.",
    alternates: { canonical: page > 1 ? `/blog?page=${page}` : "/blog" },
    openGraph: {
      title: `${title} · Esimprove`,
      description:
        "Guides, destination tips, and practical travel connectivity advice from Esimprove.",
      type: "website",
      url: page > 1 ? `/blog?page=${page}` : "/blog",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Esimprove`,
      description:
        "Guides, destination tips, and practical travel connectivity advice from Esimprove.",
    },
  };
}

function formatDate(date: Date | null): string {
  if (!date) return "Unpublished";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : "1") || 1);
  const db = await getDb();
  const [{ articles, total, pageCount }, categories] = await Promise.all([
    listPublishedArticles(db, { page, pageSize: PAGE_SIZE }),
    listCategoriesWithCounts(db),
  ]);

  const featured = page === 1 ? articles[0] : undefined;
  const rest = page === 1 ? articles.slice(1) : articles;

  return (
    <div className="es-page">
      <section className="es-page-hero">
        <p className="es-eyebrow">Esimprove journal</p>
        <h1>
          Travel smarter. <span className="es-green">Stay connected.</span>
        </h1>
        <p className="es-page-lead">
          Practical guides, destination notes, and honest advice for getting online wherever
          you land.
        </p>
      </section>

      {categories.length > 0 ? (
        <nav className="es-page-section" aria-label="Blog categories">
          <div className="chip-row">
            <Link href="/blog" className="chip chip-active">All articles</Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/blog/category/${category.slug}`} className="chip">
                {category.name} ({category.articleCount})
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      {total === 0 ? (
        <section className="es-page-section">
          <div className="es-static-card">
            <h2>No articles published yet</h2>
            <p className="muted">
              Articles will appear here once an administrator publishes them. Drafts and
              scheduled posts are never shown publicly.
            </p>
          </div>
        </section>
      ) : (
        <>
          {featured ? (
            <section className="es-page-section" aria-labelledby="featured-heading">
              <h2 id="featured-heading" className="visually-hidden">Featured article</h2>
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
                    <Link className="link" href={`/blog/${featured.slug}`}>{featured.title}</Link>
                  </h2>
                  <p>{featured.excerpt}</p>
                  <p className="small muted">
                    {featured.authorName ? `${featured.authorName} · ` : ""}
                    <time dateTime={featured.publishedAt?.toISOString()}>{formatDate(featured.publishedAt)}</time>
                  </p>
                  <Link className="es-button es-button-primary" href={`/blog/${featured.slug}`}>
                    Read article
                  </Link>
                </div>
              </article>
            </section>
          ) : null}

          <section className="es-page-section" aria-labelledby="articles-heading">
            <div className="es-page-section-head">
              <p className="es-eyebrow">Latest</p>
              <h2 id="articles-heading">All articles</h2>
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
                      <Link className="link" href={`/blog/${article.slug}`}>{article.title}</Link>
                    </h3>
                    <p>{article.excerpt}</p>
                    <p className="small muted">
                      <time dateTime={article.publishedAt?.toISOString()}>{formatDate(article.publishedAt)}</time>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            {pageCount > 1 ? (
              <nav className="pagination" aria-label="Blog pages">
                {page > 1 ? (
                  <Link className="page-link" href={page === 2 ? "/blog" : `/blog?page=${page - 1}`} rel="prev">
                    ← Previous
                  </Link>
                ) : null}
                <span className="small muted">Page {page} of {pageCount}</span>
                {page < pageCount ? (
                  <Link className="page-link" href={`/blog?page=${page + 1}`} rel="next">
                    Next →
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
