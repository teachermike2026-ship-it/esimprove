import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getDestinations, getRegions } from "@/lib/catalog";
import { DestinationCard } from "@/components/destination-card";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Browse eSIM destinations and compare plans by region, validity, and price.",
  alternates: { canonical: "/destinations" },
};

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const db = await getDb();
  const [regions, destinations] = await Promise.all([
    getRegions(db),
    getDestinations(db, { regionSlug: region }),
  ]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Destination catalogue</p>
          <h1>Destinations</h1>
          <p className="lead">
            Choose a country or region to see plans. Coverage, network, and supplier terms vary by
            plan and operator; each plan page shows the specifics that apply.
          </p>
        </div>
        <SearchForm />
      </div>

      <nav className="pill-row section-tight" aria-label="Filter destinations by region">
        <Link className={`badge ${!region ? "badge-success" : "badge-neutral"}`} href="/destinations">
          All regions
        </Link>
        {regions.map((item) => (
          <Link
            key={item.id}
            className={`badge ${region === item.slug ? "badge-success" : "badge-neutral"}`}
            href={`/destinations?region=${encodeURIComponent(item.slug)}`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {destinations.length > 0 ? (
        <div className="grid grid-4">
          {destinations.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      ) : (
        <EmptyState title="No destinations in this filter" action={{ href: "/destinations", label: "Show all destinations" }}>
          The catalogue does not have a destination for that region yet.
        </EmptyState>
      )}
    </>
  );
}
