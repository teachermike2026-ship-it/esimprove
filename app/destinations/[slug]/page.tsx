import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import {
  getDestinationBySlug,
  getDestinations,
  getPlansForDestination,
} from "@/lib/catalog";
import { PlanCard } from "@/components/plan-card";
import { DestinationCard } from "@/components/destination-card";
import { formatMoney } from "@/lib/money";
import { siteUrl } from "@/lib/config";
import { absoluteLocalizedUrl } from "@/lib/i18n/config";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getI18n();
  const db = await getDb();
  const row = await getDestinationBySlug(db, slug);
  if (!row) notFound();
  return localizedMetadata({
    path: `/destinations/${row.destination.slug}`,
    title: t("catalog.destinationTitle", { country: row.destination.name }),
    description: row.destination.summary || t("catalog.destinationSummary", { country: row.destination.name }),
  });
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { t, href, locale } = await getI18n();
  const db = await getDb();
  const row = await getDestinationBySlug(db, slug);
  if (!row) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const plans = await getPlansForDestination(db, row.destination.id);
  const regionDestinations = await getDestinations(db, { regionSlug: row.region.slug });
  const otherDestinations = regionDestinations.filter((item) => item.id !== row.destination.id);
  const fromPrice = plans.length > 0 ? Math.min(...plans.map((plan) => plan.priceMinor)) : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("catalog.breadcrumbDestinations"),
        item: absoluteLocalizedUrl("/destinations", locale, siteUrl),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: row.region.name,
        item: absoluteLocalizedUrl(`/regions/${row.region.slug}`, locale, siteUrl),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: row.destination.name,
        item: absoluteLocalizedUrl(`/destinations/${row.destination.slug}`, locale, siteUrl),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/destinations")}>{t("catalog.breadcrumbDestinations")}</Link>
          </li>
          <li>
            <Link href={href(`/regions/${row.region.slug}`)}>{row.region.name}</Link>
          </li>
          <li aria-current="page">{row.destination.name}</li>
        </ol>
      </nav>

      <section className={`card destination-hero accent-${row.region.accent}`}>
        <div className="destination-hero-art" aria-hidden="true">
          <span dir="ltr">{row.destination.countryCode}</span>
        </div>
        <div className="destination-hero-copy">
          <p className="eyebrow">{row.region.name}</p>
          <h1>{t("catalog.destinationTitle", { country: row.destination.name })}</h1>
          <p className="lead">{row.destination.description}</p>
          <div className="pill-row">
            <span className="badge badge-neutral">
              {t("catalog.plansBadge", { count: plans.length })}
            </span>
            {fromPrice !== null ? (
              <span className="badge badge-neutral" dir="ltr">
                {t("catalog.fromPrice", { price: formatMoney(fromPrice, "USD") })}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="destination-plans">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("catalog.compare")}</p>
            <h2 id="destination-plans">
              {t("catalog.plansFor", { country: row.destination.name })}
            </h2>
            <p className="muted">{t("catalog.compareBody")}</p>
          </div>
          <Link
            className="button button-ghost"
            href={href(`/plans?destination=${row.destination.slug}`)}
          >
            {t("catalog.filterAllPlans")}
          </Link>
        </div>
        <div className="grid grid-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="region-more">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("catalog.keepExploring")}</p>
            <h2 id="region-more">{t("catalog.moreIn", { region: row.region.name })}</h2>
          </div>
        </div>
        <div className="grid grid-4">
          {otherDestinations.slice(0, 4).map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      </section>
    </>
  );
}
