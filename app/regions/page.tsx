import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getRegions } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { ArrowRight, GlobeIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Regional plans",
  description:
    "Browse the demo eSIM regions, destination counts, and starting prices. Regional coverage is illustrative and not a live supplier quote.",
  alternates: { canonical: "/regions" },
};

export default async function RegionsPage() {
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
        <p className="es-eyebrow">Regional plans</p>
        <h1 id="regions-title">
          One region. <span className="es-green">More possibilities.</span>
        </h1>
        <p className="es-page-lead">
          Explore {regions.length} demo regions covering {destinationCount} destinations and{" "}
          {planCount} plan options. Regional availability, coverage, and pricing remain
          illustrative.
        </p>
        <div className="es-page-actions">
          <Link className="es-button es-button-primary" href="/destinations">
            Browse all countries <ArrowRight />
          </Link>
          <Link className="es-button es-button-secondary" href="/plans">
            Compare every plan
          </Link>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="region-list-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">Choose a region</p>
          <h2 id="region-list-title">Regional demo catalogue</h2>
          <p>
            Each region links to its destination list and sample plans. No live carrier or
            supplier coverage is implied.
          </p>
        </div>
        <div className="es-page-grid es-page-grid-3">
          {regions.map((region) => (
            <Link
              key={region.id}
              className="es-region-tile"
              href={`/regions/${region.slug}`}
            >
              <span className="es-region-tile-icon">
                <GlobeIcon />
              </span>
              <span className="es-region-tile-copy">
                <small>
                  {region.destinationCount} destination
                  {region.destinationCount === 1 ? "" : "s"} · {region.planCount} plan
                  {region.planCount === 1 ? "" : "s"}
                </small>
                <strong>{region.name}</strong>
                <span>{region.description}</span>
              </span>
              <span className="es-region-tile-footer">
                {region.fromPriceMinor !== null
                  ? `From ${formatMoney(region.fromPriceMinor, "USD")}`
                  : "See plans"}
                <ArrowRight />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
