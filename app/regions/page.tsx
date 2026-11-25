import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getRegions } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { ArrowRight, GlobeIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/regions",
    title: t("regions.metaTitle"),
    description: t("regions.metaDescription"),
  });
}

export default async function RegionsPage() {
  const { t, href } = await getI18n();
  const db = await getDb();
  const regions = await getRegions(db);
  const destinationCount = regions.reduce(
    (total, region) => total + region.destinationCount,
    0,
  );
  const planCount = regions.reduce((total, region) => total + region.planCount, 0);

  return (
    <div className="es-page">
      <section className="es-page-hero" aria-labelledby="regions-title">
        <p className="es-eyebrow">{t("regions.eyebrow")}</p>
        <h1 id="regions-title">
          {t("regions.title")} <span className="es-green">{t("regions.titleGreen")}</span>
        </h1>
        <p className="es-page-lead">
          {t("regions.lead", {
            regions: regions.length,
            destinations: destinationCount,
            plans: planCount,
          })}
        </p>
        <div className="es-page-actions">
          <Link className="es-button es-button-primary" href={href("/destinations")}>
            {t("regions.browseAll")} <ArrowRight />
          </Link>
          <Link className="es-button es-button-secondary" href={href("/plans")}>
            {t("regions.compareEvery")}
          </Link>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="region-list-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">{t("regions.chooseEyebrow")}</p>
          <h2 id="region-list-title">{t("regions.catalogue")}</h2>
          <p>{t("regions.catalogueBody")}</p>
        </div>
        <div className="es-page-grid es-page-grid-3">
          {regions.map((region) => (
            <Link
              key={region.id}
              className="es-region-tile"
              href={href(`/regions/${region.slug}`)}
            >
              <span className="es-region-tile-icon">
                <GlobeIcon />
              </span>
              <span className="es-region-tile-copy">
                <small>
                  {t("regions.destinationPlans", {
                    destinations: region.destinationCount,
                    plans: region.planCount,
                  })}
                </small>
                <strong>{region.name}</strong>
                <span>{region.description}</span>
              </span>
              <span className="es-region-tile-footer">
                <span dir="ltr">
                  {region.fromPriceMinor !== null
                    ? t("regions.fromPrice", {
                        price: formatMoney(region.fromPriceMinor, "USD"),
                      })
                    : t("regions.seePlans")}
                </span>
                <ArrowRight />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
