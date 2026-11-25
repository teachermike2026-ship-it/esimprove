import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getPlans } from "@/lib/catalog";
import { PlanCard } from "@/components/plan-card";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/empty-state";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/search",
    title: t("search.metaTitle"),
    description: t("search.metaDescription"),
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { t, href } = await getI18n();
  const query = q?.trim() ?? "";
  const db = await getDb();
  const plans = query ? await getPlans(db, { q: query, limit: 40 }) : [];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("search.eyebrow")}</p>
          <h1>{t("search.title")}</h1>
          <p className="lead">{t("search.lead")}</p>
        </div>
      </div>
      <SearchForm defaultValue={query} />
      <div className="section-tight">
        {query ? (
          <p className="muted" role="status">
            {plans.length === 1
              ? t("search.oneResult", { query })
              : t("search.results", { count: plans.length, query })}
          </p>
        ) : (
          <div className="pill-row">
            <span className="muted small">{t("search.try")}</span>
            {["Japan", "Europe", "5 GB", "United States", "Thailand"].map((term) => (
              <Link
                key={term}
                className="badge badge-neutral"
                href={href(`/search?q=${encodeURIComponent(term)}`)}
              >
                {term}
              </Link>
            ))}
          </div>
        )}
      </div>
      {query && plans.length === 0 ? (
        <EmptyState
          title={t("search.noResultsTitle")}
          action={{ href: href("/plans"), label: t("search.browseAll") }}
        >
          {t("search.noResultsBody")}
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
