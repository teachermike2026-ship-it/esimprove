"use client";

import { useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/country-flag";
import { ArrowRight, GlobeIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { formatMoney } from "@/lib/money";

export interface ExplorerDestination {
  slug: string;
  name: string;
  countryCode: string;
  regionName: string;
  planCount: number;
  fromPriceMinor: number | null;
  fromValidityDays: number | null;
  currency: string;
}

export interface ExplorerRegion {
  slug: string;
  name: string;
  description: string;
  destinationCount: number;
  planCount: number;
  fromPriceMinor: number | null;
}

export function DestinationExplorer({
  destinations,
  regions,
}: {
  destinations: ExplorerDestination[];
  regions: ExplorerRegion[];
}) {
  const { t, href } = useI18n();
  const [view, setView] = useState<"popular" | "regional">("popular");

  const planLabel = (count: number) =>
    count === 1
      ? t("home.explorer.planOption", { count })
      : t("home.explorer.planOptions", { count });
  const destinationLabel = (count: number) =>
    count === 1
      ? t("home.explorer.destinationCount", { count })
      : t("home.explorer.destinationsCount", { count });
  const regionPlanLabel = (count: number) =>
    count === 1
      ? t("home.explorer.planCount", { count })
      : t("home.explorer.plansCount", { count });

  return (
    <div className="es-explorer">
      <div className="es-explorer-tabs" role="group" aria-label={t("home.explorer.aria")}>
        <button
          type="button"
          className={view === "popular" ? "is-active" : ""}
          aria-pressed={view === "popular"}
          onClick={() => setView("popular")}
        >
          {t("home.explorer.popular")}
        </button>
        <button
          type="button"
          className={view === "regional" ? "is-active" : ""}
          aria-pressed={view === "regional"}
          onClick={() => setView("regional")}
        >
          {t("home.explorer.regional")}
        </button>
      </div>

      <p className="visually-hidden" role="status">
        {view === "popular"
          ? t("home.explorer.showingDestinations", { count: destinations.length })
          : t("home.explorer.showingRegions", { count: regions.length })}
      </p>

      {view === "popular" ? (
        <div className="es-destination-grid">
          {destinations.map((destination) => (
            <Link
              key={destination.slug}
              className="es-destination-card"
              href={href(`/destinations/${destination.slug}`)}
            >
              <span className="es-destination-head">
                <span className="es-destination-flag">
                  <CountryFlag code={destination.countryCode} label={destination.name} />
                </span>
                <span className="es-destination-title">
                  <small dir="ltr">eSIM · {destination.regionName}</small>
                  <strong>{destination.name}</strong>
                </span>
              </span>
              <span className="es-destination-rule" aria-hidden="true" />
              <span className="es-destination-price">
                <span className="es-destination-price-copy">
                  <small>{t("home.explorer.priceFrom")}</small>
                  <span className="es-price-line" dir="ltr">
                    <strong>
                      {destination.fromPriceMinor !== null
                        ? formatMoney(destination.fromPriceMinor, destination.currency)
                        : t("common.unavailable")}
                    </strong>
                    {destination.fromValidityDays !== null ? (
                      <span>{t("home.explorer.forDays", { count: destination.fromValidityDays })}</span>
                    ) : null}
                  </span>
                </span>
                <span className="es-destination-arrow">
                  <ArrowRight />
                </span>
              </span>
              <span className="es-destination-note">{planLabel(destination.planCount)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="es-destination-grid es-region-grid">
          {regions.map((region) => (
            <Link
              key={region.slug}
              className="es-destination-card es-region-card"
              href={href(`/regions/${region.slug}`)}
            >
              <span className="es-destination-head">
                <span className="es-region-icon">
                  <GlobeIcon />
                </span>
                <span className="es-destination-title">
                  <small>{t("home.explorer.regionalPlan")}</small>
                  <strong>{region.name}</strong>
                </span>
              </span>
              <span className="es-region-description">{region.description}</span>
              <span className="es-destination-rule" aria-hidden="true" />
              <span className="es-destination-price">
                <span className="es-destination-price-copy">
                  <small>{t("home.explorer.priceFrom")}</small>
                  <span className="es-price-line" dir="ltr">
                    <strong>
                      {region.fromPriceMinor !== null
                        ? formatMoney(region.fromPriceMinor, "USD")
                        : t("common.unavailable")}
                    </strong>
                  </span>
                </span>
                <span className="es-destination-arrow">
                  <ArrowRight />
                </span>
              </span>
              <span className="es-destination-note">
                {destinationLabel(region.destinationCount)} · {regionPlanLabel(region.planCount)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="es-explorer-footer">
        <Link
          className="es-button es-button-yellow"
          href={href(view === "popular" ? "/destinations" : "/regions")}
        >
          {view === "popular" ? t("home.explorer.seeAllCountries") : t("home.explorer.seeAllRegions")}
          <ArrowRight />
        </Link>
        <p>{t("home.explorer.deliveryNote")}</p>
      </div>
    </div>
  );
}
