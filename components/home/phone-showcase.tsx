"use client";

import { useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/country-flag";
import {
  ArrowRight,
  GlobeIcon,
  QrIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { formatData, formatMoney } from "@/lib/money";

export interface PhoneDestination {
  slug: string;
  name: string;
  countryCode: string;
  planName: string;
  dataMb: number;
  validityDays: number;
  priceMinor: number;
  currency: string;
}

export interface PhoneRegion {
  slug: string;
  name: string;
  destinationCount: number;
  planCount: number;
  fromPriceMinor: number | null;
}

interface PhoneShowcaseProps {
  destinations: PhoneDestination[];
  regions: PhoneRegion[];
  destinationCount: number;
  regionCount: number;
  planCount: number;
}

const SHORT_NAMES: Record<string, string> = {
  "United Arab Emirates": "UAE",
  "United Kingdom": "UK",
  "United States": "USA",
  "South Africa": "S. Africa",
  "South Korea": "S. Korea",
  "New Zealand": "N. Zealand",
};

function shortName(name: string): string {
  return SHORT_NAMES[name] ?? name;
}

export function PhoneShowcase({
  destinations,
  regions,
  destinationCount,
  regionCount,
  planCount,
}: PhoneShowcaseProps) {
  const [view, setView] = useState<"country" | "region">("country");
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [regionIndex, setRegionIndex] = useState(0);

  const destination = destinations[destinationIndex] ?? destinations[0] ?? null;
  const region = regions[regionIndex] ?? regions[0] ?? null;
  const shownRegions = regions.slice(0, 4);

  return (
    <div className="es-phone-stage">
      <div className="es-phone-halo" aria-hidden="true" />

      <div className="es-phone es-phone-back" aria-hidden="true">
        <div className="es-phone-frame">
          <div className="es-phone-screen">
            <span className="es-phone-island" />
            <div className="es-statusbar">
              <span>9:41</span>
              <span className="es-status-icons">
                <span>5G</span>
                <span className="es-battery" />
              </span>
            </div>
            <div className="es-app es-app-back">
              <p className="es-app-label">Installation</p>
              <h3>Three steps to get connected</h3>
              <div className="es-back-ring">
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
              <ol className="es-back-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Check your device</strong>
                    <small>Confirm eSIM support and carrier lock status.</small>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Install while online</strong>
                    <small>Use a stable connection before you travel.</small>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Label your line</strong>
                    <small>Keep your primary SIM for calls and messages.</small>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="es-phone es-phone-front">
        <div className="es-phone-frame">
          <div className="es-phone-screen">
            <span className="es-phone-island" aria-hidden="true" />
            <div className="es-statusbar" aria-hidden="true">
              <span>9:41</span>
              <span className="es-status-icons">
                <span>5G</span>
                <span className="es-battery" />
              </span>
            </div>

            <div className="es-app">
              <div className="es-app-head">
                <div>
                  <h3>
                    {view === "country" ? "Explore supported countries" : "Explore regions"}
                  </h3>
                  <p>Browse plans and manage your eSIMs</p>
                </div>
                <span className="es-app-logo" aria-hidden="true">
                  e
                </span>
              </div>

              <div className="es-app-search" aria-hidden="true">
                <SearchIcon />
                <span>Search your destination</span>
              </div>

              <div className="es-app-tabs" role="group" aria-label="Catalogue view">
                <button
                  type="button"
                  className={view === "country" ? "is-active" : ""}
                  aria-pressed={view === "country"}
                  onClick={() => setView("country")}
                >
                  Country
                </button>
                <button
                  type="button"
                  className={view === "region" ? "is-active" : ""}
                  aria-pressed={view === "region"}
                  onClick={() => setView("region")}
                >
                  Regional
                </button>
              </div>

              {view === "country" ? (
                <>
                  <p className="es-app-label">Top picks</p>
                  <div className="es-app-picks">
                    {destinations.slice(0, 4).map((item, index) => (
                      <button
                        key={item.slug}
                        type="button"
                        className={index === destinationIndex ? "is-selected" : ""}
                        aria-pressed={index === destinationIndex}
                        aria-label={`View ${item.name} plans`}
                        onClick={() => setDestinationIndex(index)}
                      >
                        <span className="es-app-flag">
                          <CountryFlag code={item.countryCode} label={item.name} />
                        </span>
                        <span>{shortName(item.name)}</span>
                      </button>
                    ))}
                  </div>

                  <p className="es-app-label">All destinations</p>
                  <div className="es-app-list">
                    {destinations.map((item, index) => (
                      <button
                        key={item.slug}
                        type="button"
                        className={`es-app-row${index === destinationIndex ? " is-selected" : ""}`}
                        aria-pressed={index === destinationIndex}
                        onClick={() => setDestinationIndex(index)}
                      >
                        <span className="es-app-flag">
                          <CountryFlag code={item.countryCode} label={item.name} />
                        </span>
                        <span className="es-app-row-copy">
                          <strong>{item.name}</strong>
                          <small>
                            {formatData(item.dataMb)} · {item.validityDays} days
                          </small>
                        </span>
                        <span className="es-app-row-price">
                          {formatMoney(item.priceMinor, item.currency)}
                        </span>
                        <ArrowRight className="es-app-row-arrow" />
                      </button>
                    ))}
                  </div>

                  {destination ? (
                    <Link className="es-app-cta" href={`/destinations/${destination.slug}`}>
                      <span>View {destination.name} plans</span>
                      <ArrowRight />
                    </Link>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="es-app-label">Regions</p>
                  <div className="es-app-list es-app-list-regions">
                    {shownRegions.map((item, index) => (
                      <button
                        key={item.slug}
                        type="button"
                        className={`es-app-row${index === regionIndex ? " is-selected" : ""}`}
                        aria-pressed={index === regionIndex}
                        onClick={() => setRegionIndex(index)}
                      >
                        <span className="es-app-region-icon" aria-hidden="true">
                          <GlobeIcon />
                        </span>
                        <span className="es-app-row-copy">
                          <strong>{item.name}</strong>
                          <small>
                            {item.destinationCount} destination
                            {item.destinationCount === 1 ? "" : "s"} · {item.planCount} plan
                            {item.planCount === 1 ? "" : "s"}
                          </small>
                        </span>
                        <span className="es-app-row-price">
                          {item.fromPriceMinor !== null
                            ? `from ${formatMoney(item.fromPriceMinor, "USD")}`
                            : "Unavailable"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {region ? (
                    <Link className="es-app-cta" href={`/regions/${region.slug}`}>
                      <span>View {region.name} plans</span>
                      <ArrowRight />
                    </Link>
                  ) : null}
                </>
              )}
            </div>

            <div className="es-phone-nav">
              <Link href="/destinations" className="is-active">
                <GlobeIcon />
                <span>Countries</span>
              </Link>
              <Link href="/portal">
                <QrIcon />
                <span>eSIMs</span>
              </Link>
              <Link href="/login">
                <UserIcon />
                <span>Account</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Link className="es-float es-float-coverage" href="/destinations">
        <span className="es-float-icon">
          <GlobeIcon />
        </span>
        <span className="es-float-copy">
          <strong>{destinationCount} destinations</strong>
          <small>
            Across {regionCount} regions · {planCount} plans
          </small>
        </span>
        <ArrowRight className="es-float-arrow" />
      </Link>

      <Link className="es-float es-float-install" href="/guides">
        <span className="es-float-icon es-float-icon-qr">
          <QrIcon />
        </span>
        <span className="es-float-copy">
          <strong>Install before you fly</strong>
          <small>iOS and Android walkthroughs</small>
        </span>
      </Link>
    </div>
  );
}
