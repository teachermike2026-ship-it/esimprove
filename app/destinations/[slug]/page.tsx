import type { Metadata } from "next";
import Link from "next/link";
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
import { canonicalUrl } from "@/lib/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDb();
  const row = await getDestinationBySlug(db, slug);
  if (!row) return { title: "Destination not found" };
  return {
    title: `${row.destination.name} demo eSIM plans`,
    description: row.destination.summary,
    alternates: { canonical: canonicalUrl(`/destinations/${row.destination.slug}`) },
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDb();
  const row = await getDestinationBySlug(db, slug);
  if (!row) notFound();

  const plans = await getPlansForDestination(db, row.destination.id);
  const regionDestinations = await getDestinations(db, { regionSlug: row.region.slug });
  const otherDestinations = regionDestinations.filter((item) => item.id !== row.destination.id);
  const fromPrice = plans.length > 0 ? Math.min(...plans.map((plan) => plan.priceMinor)) : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Destinations", item: canonicalUrl("/destinations") },
      {
        "@type": "ListItem",
        position: 2,
        name: row.region.name,
        item: canonicalUrl(`/regions/${row.region.slug}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: row.destination.name,
        item: canonicalUrl(`/destinations/${row.destination.slug}`),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/destinations">Destinations</Link>
          </li>
          <li>
            <Link href={`/regions/${row.region.slug}`}>{row.region.name}</Link>
          </li>
          <li aria-current="page">{row.destination.name}</li>
        </ol>
      </nav>

      <section className={`card destination-hero accent-${row.region.accent}`}>
        <div className="destination-hero-art" aria-hidden="true">
          <span>{row.destination.countryCode}</span>
        </div>
        <div className="destination-hero-copy">
          <p className="eyebrow">{row.region.name}</p>
          <h1>{row.destination.name} demo eSIM plans</h1>
          <p className="lead">{row.destination.description}</p>
          <div className="pill-row">
            <span className="badge badge-demo">Demo coverage</span>
            <span className="badge badge-neutral">{plans.length} plans</span>
            {fromPrice !== null ? (
              <span className="badge badge-neutral">From {formatMoney(fromPrice, "USD")}</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="destination-plans">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Compare</p>
            <h2 id="destination-plans">Plans for {row.destination.name}</h2>
            <p className="muted">
              Prices are computed locally from demo cost and markup fields. They are not
              supplier quotes or live availability.
            </p>
          </div>
          <Link className="button button-ghost" href={`/plans?destination=${row.destination.slug}`}>
            Filter all plans
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
            <p className="eyebrow">Keep exploring</p>
            <h2 id="region-more">More in {row.region.name}</h2>
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
