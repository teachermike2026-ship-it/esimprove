import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getTagBySlug, listPublishedArticles } from "@/lib/blog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDb();
  const tag = await getTagBySlug(db, slug);
  if (!tag) return { title: "Tag not found", robots: { index: false, follow: false } };
  return {
    title: `Articles tagged “${tag.name}”`,
    description: `Browse articles tagged ${tag.name} from Esimprove.`,
    alternates: { canonical: `/blog/tag/${tag.slug}` },
    openGraph: {
      title: `Articles tagged “${tag.name}” · Esimprove`,
      description: `Browse articles tagged ${tag.name} from Esimprove.`,
      type: "website",
    },
  };
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export default async function BlogTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  return (
    <div className="es-page">
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/blog">Blog</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">#{tag.name}</span>
      </nav>

      <section className="es-page-hero">
        <p className="es-eyebrow">Tag</p>
        <h1>#{tag.name}</h1>
      </section>

      {total === 0 ? (
        <section className="card section-tight">
          <p className="muted">No published articles with this tag yet.</p>
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
                  <h3><Link className="link" href={`/blog/${article.slug}`}>{article.title}</Link></h3>
                  <p>{article.excerpt}</p>
                  <p className="small muted"><time dateTime={article.publishedAt?.toISOString()}>{formatDate(article.publishedAt)}</time></p>
                </div>
              </article>
            ))}
          </div>
          {pageCount > 1 ? (
            <nav className="pagination" aria-label="Tag pages">
              {page > 1 ? <Link className="page-link" href={`/blog/tag/${slug}?page=${page - 1}`}>← Previous</Link> : null}
              <span className="small muted">Page {page} of {pageCount}</span>
              {page < pageCount ? <Link className="page-link" href={`/blog/tag/${slug}?page=${page + 1}`}>Next →</Link> : null}
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}
