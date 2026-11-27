import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { localeIntl } from "@/lib/i18n/config";
import { editorialCard, featuredEditorial } from "@/lib/blog-public";
import { EDITORIAL_ARTICLES } from "@/lib/editorial";
import { BlogCardView } from "@/components/blog/blog-card";
import { ArrowRight } from "@/components/icons";

/** "Travel Guides & Insights": the last homepage section, right before the footer. */
export async function HomeBlogSection() {
  const { t, href, locale } = await getI18n();
  const featured = editorialCard(featuredEditorial());
  const latest = EDITORIAL_ARTICLES.filter((article) => article.slug !== featured.slug)
    .slice(0, 3)
    .map(editorialCard);
  const dateFormat = new Intl.DateTimeFormat(localeIntl(locale), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const labels = {
    minRead: (minutes: number) => t("blog.minRead", { minutes }),
    formatDate: (date: Date) => dateFormat.format(date),
  };

  return (
    <section className="es-home-blog" aria-labelledby="home-blog-title">
      <div className="es-shell">
        <header className="es-home-blog-head">
          <div>
            <p className="es-eyebrow">{t("home.blog.eyebrow")}</p>
            <h2 id="home-blog-title">
              {t("home.blog.title")} <span className="es-green">{t("home.blog.titleGreen")}</span>
            </h2>
            <p>
              {t("home.blog.body")}
              {locale !== "en" ? <span className="es-home-blog-note"> {t("home.blog.englishNote")}</span> : null}
            </p>
          </div>
          <Link className="es-button es-button-secondary es-home-blog-cta" href={href("/blog")} data-track="cta_clicked">
            {t("home.blog.cta")} <ArrowRight />
          </Link>
        </header>

        <div className="es-home-blog-grid">
          <div className="es-home-blog-featured">
            <p className="es-home-blog-label">{t("home.blog.featured")}</p>
            <BlogCardView card={featured} href={href} labels={labels} variant="featured" track="article_link_clicked" />
          </div>
          <div className="es-home-blog-list">
            {latest.map((card) => (
              <BlogCardView key={card.key} card={card} href={href} labels={labels} track="article_link_clicked" />
            ))}
          </div>
        </div>

        <div className="es-home-blog-footer">
          <Link className="es-button es-button-primary" href={href("/blog")} data-track="cta_clicked">
            {t("home.blog.cta")} <ArrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}
