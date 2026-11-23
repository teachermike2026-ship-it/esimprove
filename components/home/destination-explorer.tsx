"use client";

import { useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/country-flag";
import { ArrowRight, GlobeIcon } from "@/components/icons";
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
  const [view, setView] = useState<"popular" | "regional">("popular");

  return (
    <div className="es-explorer">
      <div className="es-explorer-tabs" role="group" aria-label="Destination view">
        <button
          type="button"
          className={view === "popular" ? "is-active" : ""}
          aria-pressed={view === "popular"}
          onClick={() => setView("popular")}
        >
          Popular destinations
        </button>
        <button
          type="button"
          className={view === "regional" ? "is-active" : ""}
          aria-pressed={view === "regional"}
          onClick={() => setView("regional")}
        >
          Regional plans
        </button>
      </div>

      <p className="visually-hidden" role="status">
        {view === "popular"
          ? `Showing ${destinations.length} popular destinations`
          : `Showing ${regions.length} regions`}
      </p>

      {view === "popular" ? (
        <div className="es-destination-grid">
          {destinations.map((destination) => (
            <Link
              key={destination.slug}
              className="es-destination-card"
              href={`/destinations/${destination.slug}`}
            >
              <span className="es-destination-head">
                <span className="es-destination-flag">
                  <CountryFlag code={destination.countryCode} label={destination.name} />
                </span>
                <span className="es-destination-title">
                  <small>eSIM · {destination.regionName}</small>
                  <strong>{destination.name}</strong>
                </span>
              </span>
              <span className="es-destination-rule" aria-hidden="true" />
              <span className="es-destination-price">
                <span className="es-destination-price-copy">
                  <small>Price start from</small>
                  <span className="es-price-line">
                    <strong>
                      {destination.fromPriceMinor !== null
                        ? formatMoney(destination.fromPriceMinor, destination.currency)
                        : "Unavailable"}
                    </strong>
                    {destination.fromValidityDays !== null ? (
                      <span>for {destination.fromValidityDays} days</span>
                    ) : null}
                  </span>
                </span>
                <span className="es-destination-arrow">
                  <ArrowRight />
                </span>
              </span>
              <span className="es-destination-note">
                {destination.planCount} plan option{destination.planCount === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="es-destination-grid es-region-grid">
          {regions.map((region) => (
            <Link
              key={region.slug}
              className="es-destination-card es-region-card"
              href={`/regions/${region.slug}`}
            >
              <span className="es-destination-head">
                <span className="es-region-icon">
                  <GlobeIcon />
                </span>
                <span className="es-destination-title">
                  <small>Regional plan</small>
                  <strong>{region.name}</strong>
                </span>
              </span>
              <span className="es-region-description">{region.description}</span>
              <span className="es-destination-rule" aria-hidden="true" />
              <span className="es-destination-price">
                <span className="es-destination-price-copy">
                  <small>Price start from</small>
                  <span className="es-price-line">
                    <strong>
                      {region.fromPriceMinor !== null
                        ? formatMoney(region.fromPriceMinor, "USD")
                        : "Unavailable"}
                    </strong>
                  </span>
                </span>
                <span className="es-destination-arrow">
                  <ArrowRight />
                </span>
              </span>
              <span className="es-destination-note">
                {region.destinationCount} destination
                {region.destinationCount === 1 ? "" : "s"} · {region.planCount} plan
                {region.planCount === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="es-explorer-footer">
        <Link
          className="es-button es-button-yellow"
          href={view === "popular" ? "/destinations" : "/regions"}
        >
          {view === "popular" ? "See all countries" : "See all regions"}
          <ArrowRight />
        </Link>
        <p>Digital delivery · install before you travel</p>
      </div>
    </div>
  );
}
