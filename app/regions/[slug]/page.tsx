import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getDestinations, getPlans, getRegionBySlug } from "@/lib/catalog";
import { DestinationCard } from "@/components/destination-card";
import { PlanCard } from "@/components/plan-card";
import { canonicalUrl } from "@/lib/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDb();
  const region = await getRegionBySlug(db, slug);
  if (!region) return { title: "Region not found" };
  return {
    title: `${region.name} demo eSIM plans`,
    description: region.description,
    alternates: { canonical: canonicalUrl(`/regions/${region.slug}`) },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const region = await getRegionBySlug(db, slug);
  if (!region) notFound();
  const [destinations, plans] = await Promise.all([
    getDestinations(db, { regionSlug: region.slug }),
    getPlans(db, { region: region.slug, limit: 12 }),
  ]);

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/destinations">Destinations</Link>
          </li>
          <li aria-current="page">{region.name}</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Region</p>
          <h1>{region.name} demo eSIM plans</h1>
          <p className="lead">{region.description}</p>
          <div className="pill-row">
            <span className="badge badge-demo">Demo catalogue</span>
            <span className="badge badge-neutral">{destinations.length} destinations</span>
            <span className="badge badge-neutral">{plans.length} sample plans</span>
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="region-destinations">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Destinations</p>
            <h2 id="region-destinations">Choose a country</h2>
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
            <p className="eyebrow">Sample plans</p>
            <h2 id="region-plans">Plans across {region.name}</h2>
          </div>
          <Link className="button button-ghost" href={`/plans?region=${region.slug}`}>
            See all region plans
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
