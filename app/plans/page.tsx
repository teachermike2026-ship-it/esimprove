import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";
import { getDestinations, getPlans, getRegions } from "@/lib/catalog";
import { FilterBar } from "@/components/filter-bar";
import { PlanCard } from "@/components/plan-card";
import { EmptyState } from "@/components/empty-state";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import {
  demoPlan,
  demoPlanMatchesFilters,
  demoProductEnabled,
} from "@/lib/demo-plan";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/plans",
    title: t("catalog.metaPlansTitle"),
    description: t("catalog.metaPlansDescription"),
  });
}

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
  const { t, href } = await getI18n();
  const db = await getDb();
  const [regions, destinations] = await Promise.all([getRegions(db), getDestinations(db)]);
  const maxPrice = numeric(params.maxPrice);
  const minDataMb = numeric(params.minDataMb);
  const minValidityDays = numeric(params.minValidityDays);
  const dbPlans = await getPlans(db, {
    q: params.q,
    destination: params.destination,
    region: params.region,
    maxPrice,
    minDataMb,
    minValidityDays,
    sort: (params.sort as "price_asc" | "price_desc" | "data_desc" | "newest" | undefined) ?? "price_asc",
    limit: 60,
  });
  const includeDemo =
    demoProductEnabled() &&
    demoPlanMatchesFilters({
      q: params.q,
      destination: params.destination,
      region: params.region,
      maxPrice,
      minDataMb,
      minValidityDays,
    });
  const plans = includeDemo
    ? params.sort === "price_desc" || params.sort === "data_desc"
      ? [...dbPlans, demoPlan]
      : [demoPlan, ...dbPlans]
    : dbPlans;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("catalog.plansEyebrow")}</p>
          <h1>{t("catalog.plansTitle")}</h1>
          <p className="lead">{t("catalog.plansLead")}</p>
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
          {plans.length === 1
            ? t("catalog.onePlanShown")
            : t("catalog.plansShown", { count: plans.length })}
        </p>
      </div>

      {plans.length > 0 ? (
        <div className="grid grid-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("catalog.noPlansTitle")}
          action={{ href: href("/plans"), label: t("catalog.clearFilters") }}
        >
          {t("catalog.noPlansBody")}
        </EmptyState>
      )}
    </>
  );
}
