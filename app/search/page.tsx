import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getPlans } from "@/lib/catalog";
import { PlanCard } from "@/components/plan-card";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Search plans",
  description: "Search eSIM plans by destination, region, or data amount.",
  alternates: { canonical: "/search" },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const db = await getDb();
  const plans = query ? await getPlans(db, { q: query, limit: 40 }) : [];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find a plan</h1>
          <p className="lead">
            Search the catalogue by destination, region, or plan name.
          </p>
        </div>
      </div>
      <SearchForm defaultValue={query} />
      <div className="section-tight">
        {query ? (
          <p className="muted" role="status">
            {plans.length} result{plans.length === 1 ? "" : "s"} for <strong>{query}</strong>.
          </p>
        ) : (
          <div className="pill-row">
            <span className="muted small">Try:</span>
            {["Japan", "Europe", "5 GB", "United States", "Thailand"].map((term) => (
              <Link key={term} className="badge badge-neutral" href={`/search?q=${encodeURIComponent(term)}`}>
                {term}
              </Link>
            ))}
          </div>
        )}
      </div>
      {query && plans.length === 0 ? (
        <EmptyState title="No plans found" action={{ href: "/plans", label: "Browse all plans" }}>
          Try a country name, a region, or a data amount such as “5 GB”.
        </EmptyState>
      ) : null}
      {plans.length > 0 ? (
        <div className="grid grid-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : null}
    </>
  );
}
