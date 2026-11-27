import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getDestinations, getPlans, getRegionBySlug } from "@/lib/catalog";
import { DestinationCard } from "@/components/destination-card";
import { PlanCard } from "@/components/plan-card";
import { EditorialGuideCard } from "@/components/blog/editorial-guide-card";
import { editorialForRegion } from "@/lib/editorial";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getI18n();
  const db = await getDb();
  const region = await getRegionBySlug(db, slug);
  if (!region) return { title: t("regions.notFound") };
  return localizedMetadata({
    path: `/regions/${region.slug}`,
    title: t("regions.metaRegionTitle", { region: region.name }),
    description:
      region.description || t("regions.metaRegionDescription", { region: region.name }),
  });
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, href } = await getI18n();
  const db = await getDb();
  const region = await getRegionBySlug(db, slug);
  if (!region) notFound();
  const guide = editorialForRegion(region.slug);
  const [destinations, plans] = await Promise.all([
    getDestinations(db, { regionSlug: region.slug }),
    getPlans(db, { region: region.slug, limit: 12 }),
  ]);

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/destinations")}>{t("regions.breadcrumbDestinations")}</Link>
          </li>
          <li aria-current="page">{region.name}</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("regions.regionEyebrow")}</p>
          <h1>{t("regions.metaRegionTitle", { region: region.name })}</h1>
          <p className="lead">{region.description}</p>
          {guide ? (
            <EditorialGuideCard
              article={guide}
              href={href}
              eyebrow={t("blog.guideEyebrow")}
              linkLabel={t("blog.readGuide")}
            />
          ) : null}
          <div className="pill-row">
            <span className="badge badge-neutral">
              {t("home.explorer.destinationsCount", { count: destinations.length })}
            </span>
            <span className="badge badge-neutral">
              {t("common.plans")}: {plans.length}
            </span>
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="region-destinations">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("nav.countries")}</p>
            <h2 id="region-destinations">{t("regions.chooseCountry")}</h2>
          </div>
        </div>
        <div className="grid grid-4">
          {destinations.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="region-plans">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("regions.plansEyebrow")}</p>
            <h2 id="region-plans">{t("regions.plansAcross", { region: region.name })}</h2>
          </div>
          <Link className="button button-ghost" href={href(`/plans?region=${region.slug}`)}>
            {t("regions.seeAllPlans")}
          </Link>
        </div>
        <div className="grid grid-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>
    </>
  );
}
