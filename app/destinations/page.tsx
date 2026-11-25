import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getDestinations, getRegions } from "@/lib/catalog";
import { DestinationCard } from "@/components/destination-card";
import { SearchForm } from "@/components/search-form";
import { EmptyState } from "@/components/empty-state";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/destinations",
    title: t("catalog.metaDestinationsTitle"),
    description: t("catalog.metaDestinationsDescription"),
  });
}

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const { region } = await searchParams;
  const { t, href } = await getI18n();
  const db = await getDb();
  const [regions, destinations] = await Promise.all([
    getRegions(db),
    getDestinations(db, { regionSlug: region }),
  ]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("catalog.destinationsEyebrow")}</p>
          <h1>{t("catalog.destinationsTitle")}</h1>
          <p className="lead">{t("catalog.destinationsLead")}</p>
        </div>
        <SearchForm />
      </div>

      <nav className="pill-row section-tight" aria-label={t("catalog.filterAria")}>
        <Link
          className={`badge ${!region ? "badge-success" : "badge-neutral"}`}
          href={href("/destinations")}
        >
          {t("catalog.allRegions")}
        </Link>
        {regions.map((item) => (
          <Link
            key={item.id}
            className={`badge ${region === item.slug ? "badge-success" : "badge-neutral"}`}
            href={href(`/destinations?region=${encodeURIComponent(item.slug)}`)}
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
        <EmptyState
          title={t("catalog.noDestinationsTitle")}
          action={{ href: href("/destinations"), label: t("catalog.showAllDestinations") }}
        >
          {t("catalog.noDestinationsBody")}
        </EmptyState>
      )}
    </>
  );
}
