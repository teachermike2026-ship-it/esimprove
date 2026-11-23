import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";
import { getDestinations, getPlans, getRegions } from "@/lib/catalog";
import { FilterBar } from "@/components/filter-bar";
import { PlanCard } from "@/components/plan-card";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Travel eSIM plans",
  description:
    "Search and filter eSIM plans by destination, region, data, validity, and price.",
  alternates: { canonical: "/plans" },
};

interface SearchParams {
  q?: string;
  destination?: string;
  region?: string;
  maxPrice?: string;
  minDataMb?: string;
  minValidityDays?: string;
  sort?: string;
}

function numeric(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const db = await getDb();
  const [regions, destinations] = await Promise.all([getRegions(db), getDestinations(db)]);
  const plans = await getPlans(db, {
    q: params.q,
    destination: params.destination,
    region: params.region,
    maxPrice: numeric(params.maxPrice),
    minDataMb: numeric(params.minDataMb),
    minValidityDays: numeric(params.minValidityDays),
    sort: (params.sort as "price_asc" | "price_desc" | "data_desc" | "newest" | undefined) ?? "price_asc",
    limit: 60,
  });

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Plan catalogue</p>
          <h1>Compare eSIM plans</h1>
          <p className="lead">
            Filter the catalogue by destination, data, validity, and price to find the plan
            that fits your trip.
          </p>
        </div>
      </div>

      <FilterBar
        regions={regions}
        destinations={destinations}
        values={{
          q: params.q,
          destination: params.destination,
          region: params.region,
          maxPrice: params.maxPrice,
          minDataMb: params.minDataMb,
          minValidityDays: params.minValidityDays,
          sort: params.sort,
        }}
      />

      <div className="section-tight">
        <p className="muted small" role="status">
          {plans.length} plan{plans.length === 1 ? "" : "s"} shown.
        </p>
      </div>

      {plans.length > 0 ? (
        <div className="grid grid-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <EmptyState title="No plans match those filters" action={{ href: "/plans", label: "Clear filters" }}>
          Try a broader region, a lower minimum data amount, or a higher maximum price.
        </EmptyState>
      )}
    </>
  );
}
