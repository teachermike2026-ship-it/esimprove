import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getRegions } from "@/lib/catalog";
import { ArrowRight, GlobeIcon, LockIcon, ShieldIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/about",
    title: t("about.metaTitle"),
    description: t("about.metaDescription"),
  });
}

export default async function AboutPage() {
  const { t, href } = await getI18n();
  const db = await getDb();
  const regions = await getRegions(db);
  const regionCount = regions.length;
  const destinationCount = regions.reduce(
    (total, region) => total + region.destinationCount,
    0,
  );

  return (
    <div className="es-page">
      <section className="es-page-hero" aria-labelledby="about-title">
        <p className="es-eyebrow">{t("about.eyebrow")}</p>
        <h1 id="about-title">
          {t("about.title")} <span className="es-green">{t("about.titleGreen")}</span>
        </h1>
        <p className="es-page-lead">{t("about.lead")}</p>
        <div className="es-page-actions">
          <Link className="es-button es-button-primary" href={href("/destinations")}>
            {t("about.browse")} <ArrowRight />
          </Link>
          <Link className="es-button es-button-secondary" href={href("/contact")}>
            {t("about.contact")}
          </Link>
        </div>
      </section>

      <section className="es-page-section" id="how-it-works" aria-labelledby="how-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">{t("about.howEyebrow")}</p>
          <h2 id="how-title">{t("about.howTitle")}</h2>
          <p>{t("about.howBody")}</p>
        </div>
        <div className="es-page-grid es-page-grid-3">
          <article className="es-static-card">
            <span className="es-static-icon">
              <GlobeIcon />
            </span>
            <h3>{t("about.destinationTitle")}</h3>
            <p>
              {t("about.destinationBody", {
                destinations: destinationCount,
                regions: regionCount,
              })}
            </p>
          </article>
          <article className="es-static-card">
            <span className="es-static-icon">
              <ShieldIcon />
            </span>
            <h3>{t("about.checkoutTitle")}</h3>
            <p>{t("about.checkoutBody")}</p>
          </article>
          <article className="es-static-card">
            <span className="es-static-icon">
              <LockIcon />
            </span>
            <h3>{t("about.claimsTitle")}</h3>
            <p>{t("about.claimsBody")}</p>
          </article>
        </div>
      </section>

      <section className="es-page-section" id="reviews" aria-labelledby="reviews-policy-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">{t("about.reviewsEyebrow")}</p>
          <h2 id="reviews-policy-title">{t("about.reviewsTitle")}</h2>
          <p>{t("about.reviewsBody")}</p>
        </div>
        <div className="es-static-card">
          <h3>{t("about.requireTitle")}</h3>
          <ul className="es-check-list">
            <li>{t("about.require1")}</li>
            <li>{t("about.require2")}</li>
            <li>{t("about.require3")}</li>
            <li>{t("about.require4")}</li>
          </ul>
          <p className="es-muted-note">{t("about.reviewsNote")}</p>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="company-title">
        <div className="es-static-cta">
          <div>
            <h2 id="company-title">{t("about.companyTitle")}</h2>
            <p>{t("about.companyBody")}</p>
          </div>
          <Link className="es-button es-button-primary" href={href("/contact")}>
            {t("about.contactCta")} <ArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
