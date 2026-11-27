import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCategoryBySlug } from "@/lib/blog";
import { listBlogCards, listBlogCategories, paginate } from "@/lib/blog-public";
import { MIN_INDEXABLE_CATEGORY_ARTICLES, getEditorialCategory } from "@/lib/editorial";
import { blogMetadata, blogUrl } from "@/lib/blog-seo";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { getI18n } from "@/lib/i18n/server";
import { localeIntl } from "@/lib/i18n/config";
import { BlogCardView } from "@/components/blog/blog-card";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveCategory(slug: string) {
  const editorial = getEditorialCategory(slug);
  if (editorial) return { slug, name: editorial.name, description: editorial.description };
  const db = await getDb();
  const row = await getCategoryBySlug(db, slug);
  return row ? { slug: row.slug, name: row.name, description: row.description } : null;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { t } = await getI18n();
  const { slug } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(typeof query.page === "string" ? query.page : "1") || 1);
  const category = await resolveCategory(slug);
  if (!category) {
    return { title: t("blog.categoryNotFound"), robots: { index: false, follow: false } };
  }
  const cards = await listBlogCards(await getDb(), { categorySlug: category.slug });
  const { pageCount } = paginate(cards, 1);
  return blogMetadata({
    // Thin topic pages (a single article) stay `noindex, follow` until the topic grows.
    noindex: cards.length < MIN_INDEXABLE_CATEGORY_ARTICLES || page > pageCount,
    path: page > 1 ? `/blog/category/${category.slug}?page=${page}` : `/blog/category/${category.slug}`,
    title: page > 1 ? `${category.name} — page ${page}` : `${category.name}: Travel eSIM Articles`,
    description: category.description || t("blog.browseCategory", { category: category.name }),
  });
}

export default async function BlogCategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { t, href, locale } = await getI18n();
  const { slug } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(typeof query.page === "string" ? query.page : "1") || 1);
  const category = await resolveCategory(slug);
  if (!category) notFound();
  const db = await getDb();
  const [cards, categories] = await Promise.all([listBlogCards(db, { categorySlug: slug }), listBlogCategories(db)]);
  const pageData = paginate(cards, page);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const dateFormat = new Intl.DateTimeFormat(localeIntl(locale), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const labels = {
    minRead: (minutes: number) => t("blog.minRead", { minutes }),
    formatDate: (date: Date) => dateFormat.format(date),
  };
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: "Home", url: blogUrl("/") },
    { name: "Blog", url: blogUrl("/blog") },
    { name: category.name, url: blogUrl(`/blog/category/${category.slug}`) },
  ]);

  return (
    <div className="es-page blog-index">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: breadcrumb }} />
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <Link href={href("/")}>{t("nav.home")}</Link>
        <span aria-hidden="true">/</span>
        <Link href={href("/blog")}>{t("blog.metaTitle")}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{category.name}</span>
      </nav>

      <section className="es-page-hero blog-hero">
        <p className="es-eyebrow">{t("blog.categoryEyebrow")}</p>
        <h1>{category.name}</h1>
        {category.description ? <p className="es-page-lead">{category.description}</p> : null}
      </section>

      {locale !== "en" ? (
        <div className="callout section-tight">
          <p>{t("blog.contentNotice")}</p>
        </div>
      ) : null}

      <nav className="es-page-section blog-topics" aria-label={t("blog.categoriesAria")}>
        <div className="chip-row">
          <Link href={href("/blog")} className="chip">
            {t("blog.allArticles")}
          </Link>
          {categories.map((item) => (
            <Link
              key={item.slug}
              href={href(`/blog/category/${item.slug}`)}
              className={item.slug === slug ? "chip chip-active" : "chip"}
              aria-current={item.slug === slug ? "page" : undefined}
            >
              {item.name} ({item.count})
            </Link>
          ))}
        </div>
      </nav>

      {pageData.total === 0 ? (
        <section className="card section-tight">
          <p className="muted">{t("blog.noCategoryArticles")}</p>
        </section>
      ) : (
        <section className="es-page-section">
          <div className="blog-grid">
            {pageData.items.map((card, index) => (
              <BlogCardView key={card.key} card={card} href={href} labels={labels} headingLevel={2} eager={index < 3} />
            ))}
          </div>
          {pageData.pageCount > 1 ? (
            <nav className="pagination" aria-label={t("blog.categoryPagesAria")}>
              {pageData.page > 1 ? (
                <Link className="page-link" href={href(`/blog/category/${slug}${pageData.page > 2 ? `?page=${pageData.page - 1}` : ""}`)} rel="prev">
                  {t("blog.previous")}
                </Link>
              ) : null}
              <span className="small muted">{t("blog.pageOf", { page: pageData.page, pageCount: pageData.pageCount })}</span>
              {pageData.page < pageData.pageCount ? (
                <Link className="page-link" href={href(`/blog/category/${slug}?page=${pageData.page + 1}`)} rel="next">
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
