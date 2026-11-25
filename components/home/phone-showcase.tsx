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
import { useI18n } from "@/components/i18n-provider";
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
  const { t, href } = useI18n();
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
              <p className="es-app-label">{t("home.phone.installation")}</p>
              <h3>{t("home.phone.threeSteps")}</h3>
              <div className="es-back-ring">
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
              <ol className="es-back-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>{t("home.phone.step1Title")}</strong>
                    <small>{t("home.phone.step1Body")}</small>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>{t("home.phone.step2Title")}</strong>
                    <small>{t("home.phone.step2Body")}</small>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>{t("home.phone.step3Title")}</strong>
                    <small>{t("home.phone.step3Body")}</small>
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
                    {view === "country"
                      ? t("home.phone.exploreCountries")
                      : t("home.phone.exploreRegions")}
                  </h3>
                  <p>{t("home.phone.browsePlans")}</p>
                </div>
                <span className="es-app-logo" aria-hidden="true">
                  e
                </span>
              </div>

              <div className="es-app-search" aria-hidden="true">
                <SearchIcon />
                <span>{t("home.phone.searchDestination")}</span>
              </div>

              <div className="es-app-tabs" role="group" aria-label={t("home.phone.catalogueView")}>
                <button
                  type="button"
                  className={view === "country" ? "is-active" : ""}
                  aria-pressed={view === "country"}
                  onClick={() => setView("country")}
                >
                  {t("home.phone.country")}
                </button>
                <button
                  type="button"
                  className={view === "region" ? "is-active" : ""}
                  aria-pressed={view === "region"}
                  onClick={() => setView("region")}
                >
                  {t("home.phone.regional")}
                </button>
              </div>

              {view === "country" ? (
                <>
                  <p className="es-app-label">{t("home.phone.topPicks")}</p>
                  <div className="es-app-picks">
                    {destinations.slice(0, 4).map((item, index) => (
                      <button
                        key={item.slug}
                        type="button"
                        className={index === destinationIndex ? "is-selected" : ""}
                        aria-pressed={index === destinationIndex}
                        aria-label={t("home.phone.viewPlans", { name: item.name })}
                        onClick={() => setDestinationIndex(index)}
                      >
                        <span className="es-app-flag">
                          <CountryFlag code={item.countryCode} label={item.name} />
                        </span>
                        <span>{shortName(item.name)}</span>
                      </button>
                    ))}
                  </div>

                  <p className="es-app-label">{t("home.phone.allDestinations")}</p>
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
                            <span dir="ltr">{formatData(item.dataMb)}</span> ·{" "}
                            {t("common.days", { count: item.validityDays })}
                          </small>
                        </span>
                        <span className="es-app-row-price" dir="ltr">
                          {formatMoney(item.priceMinor, item.currency)}
                        </span>
                        <ArrowRight className="es-app-row-arrow" />
                      </button>
                    ))}
                  </div>

                  {destination ? (
                    <Link
                      className="es-app-cta"
                      href={href(`/destinations/${destination.slug}`)}
                    >
                      <span>{t("home.phone.viewPlans", { name: destination.name })}</span>
                      <ArrowRight />
                    </Link>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="es-app-label">{t("home.phone.regions")}</p>
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
                            {item.destinationCount}{" "}
                            {t("common.destinations").toLocaleLowerCase()} · {item.planCount}{" "}
                            {t("common.plans").toLocaleLowerCase()}
                          </small>
                        </span>
                        <span className="es-app-row-price" dir="ltr">
                          {item.fromPriceMinor !== null
                            ? `${t("common.from")} ${formatMoney(item.fromPriceMinor, "USD")}`
                            : t("common.unavailable")}
                        </span>
                      </button>
                    ))}
                  </div>
                  {region ? (
                    <Link className="es-app-cta" href={href(`/regions/${region.slug}`)}>
                      <span>{t("home.phone.viewPlans", { name: region.name })}</span>
                      <ArrowRight />
                    </Link>
                  ) : null}
                </>
              )}
            </div>

            <div className="es-phone-nav">
              <Link href={href("/destinations")} className="is-active">
                <GlobeIcon />
                <span>{t("home.phone.countriesNav")}</span>
              </Link>
              <Link href={href("/portal")}>
                <QrIcon />
                <span>{t("home.phone.esimsNav")}</span>
              </Link>
              <Link href={href("/login")}>
                <UserIcon />
                <span>{t("home.phone.accountNav")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Link className="es-float es-float-coverage" href={href("/destinations")}>
        <span className="es-float-icon">
          <GlobeIcon />
        </span>
        <span className="es-float-copy">
          <strong>{t("home.phone.coverage", { count: destinationCount })}</strong>
          <small>{t("home.phone.coverageSub", { regions: regionCount, plans: planCount })}</small>
        </span>
        <ArrowRight className="es-float-arrow" />
      </Link>

      <Link className="es-float es-float-install" href={href("/guides")}>
        <span className="es-float-icon es-float-icon-qr">
          <QrIcon />
        </span>
        <span className="es-float-copy">
          <strong>{t("home.phone.installBeforeFly")}</strong>
          <small>{t("home.phone.iosAndroid")}</small>
        </span>
      </Link>
    </div>
  );
}
