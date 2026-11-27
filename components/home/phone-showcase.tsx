"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import Link from "next/link";
import { CountryFlag, DestinationFlag } from "@/components/country-flag";
import { ExampleQr } from "@/components/home/example-qr";
import {
  ArrowRight,
  CheckIcon,
  GlobeIcon,
  QrIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { deviceBrands } from "@/lib/compatibility";
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

/** A destination (single-country, regional or global) as shown on a phone screen. */
export interface PhonePackage {
  slug: string;
  name: string;
  countryCode: string;
  coverage: string[];
  planCount: number;
  fromPriceMinor: number | null;
}

export interface PhonePlan {
  slug: string;
  name: string;
  dataMb: number;
  validityDays: number;
  priceMinor: number;
  currency: string;
}

interface PhoneShowcaseProps {
  destinations: PhoneDestination[];
  regions: PhoneRegion[];
  destinationCount: number;
  regionCount: number;
  planCount: number;
  packages?: PhonePackage[];
  detail?: (PhonePackage & { plans: PhonePlan[] }) | null;
  search?: { query: string; results: PhonePackage[] } | null;
  featured?: (PhonePackage & { plan: PhonePlan; more?: PhonePlan[] }) | null;
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

const FRONT_INTERVAL_MS = 3600;
const BACK_INTERVAL_MS = 4000;
const BACK_START_DELAY_MS = 1800;

/**
 * Independent auto-advancing index for one phone. It never runs while the tab
 * is hidden, while the visitor prefers reduced motion, or while `paused`.
 */
function useAutoAdvance(count: number, interval: number, startDelay: number, paused: boolean) {
  const [index, setIndex] = useState(0);
  // Bumped on manual navigation so the next automatic change waits a full interval.
  const [restart, setRestart] = useState(0);
  const goTo = useCallback((next: number) => {
    setIndex(next);
    setRestart((value) => value + 1);
  }, []);
  useEffect(() => {
    if (paused || count < 2) return;
    let intervalId: number | undefined;
    const advance = () => setIndex((current) => (current + 1) % count);
    const startId = window.setTimeout(() => {
      advance();
      intervalId = window.setInterval(advance, interval);
    }, interval + startDelay);
    return () => {
      window.clearTimeout(startId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [count, interval, startDelay, paused, restart]);
  return [index % Math.max(count, 1), goTo] as const;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** One screen of a phone carousel. Inactive screens are hidden and inert. */
function Slide({
  active,
  label,
  className,
  decorative,
  children,
}: {
  active: boolean;
  label: string;
  className: string;
  decorative?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`es-slide ${className}${active ? " is-active" : ""}`}
      {...(decorative ? {} : { role: "group", "aria-roledescription": "slide", "aria-label": label })}
      aria-hidden={active ? undefined : true}
      inert={!active}
    >
      {children}
    </div>
  );
}

export function PhoneShowcase({
  destinations,
  regions,
  destinationCount,
  regionCount,
  planCount,
  packages = [],
  detail = null,
  search = null,
  featured = null,
}: PhoneShowcaseProps) {
  const { t, href } = useI18n();
  const [view, setView] = useState<"country" | "region">("country");
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [regionIndex, setRegionIndex] = useState(0);

  const pageVisible = usePageVisible();
  const reducedMotion = usePrefersReducedMotion();
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const destination = destinations[destinationIndex] ?? destinations[0] ?? null;
  const region = regions[regionIndex] ?? regions[0] ?? null;
  const shownRegions = regions.slice(0, 4);
  const dayCount = (count: number) => (count === 1 ? t("dest.oneDay") : t("dest.daysSingle", { days: count }));
  const fromLabel = (minor: number | null, currency = "USD") =>
    minor !== null ? `${t("common.from")} ${formatMoney(minor, currency)}` : t("common.unavailable");
  const coverageLabel = (item: PhonePackage) =>
    item.coverage.length > 1 ? t("home.phone.countriesCount", { count: item.coverage.length }) : item.name;

  // Front phone: explore destinations. Back phone: installation and offers.
  const frontScreens = ["explore", ...(packages.length ? ["packages"] : []), ...(detail ? ["detail"] : []), ...(search ? ["search"] : [])];
  const backScreens = ["steps", "install", "devices", ...(featured ? ["featured"] : []), "activation"];

  const autoPaused = userPaused || hovering || focusWithin || !pageVisible || reducedMotion;
  const [frontIndex, setFrontIndex] = useAutoAdvance(frontScreens.length, FRONT_INTERVAL_MS, 0, autoPaused);
  const [backIndex] = useAutoAdvance(backScreens.length, BACK_INTERVAL_MS, BACK_START_DELAY_MS, autoPaused);
  const front = frontScreens[frontIndex];
  const back = backScreens[backIndex];
  const screenLabel = (current: number, total: number) => t("home.phone.screenLabel", { current, total });

  const onBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!stageRef.current?.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
  }, []);

  // First model family of each named brand (the generic "other" entry is left out).
  const devices = deviceBrands
    .filter((brand) => brand.id !== "other")
    .flatMap((brand) => brand.models.slice(0, 1).map((model) => ({ brand: brand.name, model })));

  return (
    <div
      ref={stageRef}
      className={`es-phone-stage${reducedMotion ? " is-reduced-motion" : ""}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={onBlur}
    >
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
            <div className="es-carousel">
              <Slide decorative active={back === "steps"} label="" className="es-app es-app-back">
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
              </Slide>

              <Slide decorative active={back === "install"} label="" className="es-app es-app-back">
                <p className="es-app-label">{t("home.phone.installation")}</p>
                <h3>{t("home.phone.scanQr")}</h3>
                <div className="es-screen-qr">
                  <ExampleQr />
                </div>
                <ol className="es-back-steps es-back-steps-compact">
                  <li>
                    <span>01</span>
                    <div>
                      <strong>{t("home.tutorial.step2Title")}</strong>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>{t("home.tutorial.step3Title")}</strong>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>{t("home.tutorial.step4Title")}</strong>
                    </div>
                  </li>
                </ol>
              </Slide>

              <Slide decorative active={back === "devices"} label="" className="es-app es-app-back">
                <p className="es-app-label">{t("home.phone.compatibleDevices")}</p>
                <h3>{t("compatibility.title")}</h3>
                <ul className="es-screen-devices">
                  {devices.map(({ brand, model }) => (
                    <li key={model.id}>
                      <span className={`es-screen-device-dot is-${model.level}`} />
                      <span className="es-app-row-copy">
                        <strong>{brand}</strong>
                        <small>{model.name}</small>
                      </span>
                      <span className={`es-screen-chip is-${model.level}`}>
                        {model.level === "likely" ? t("compatibility.levelLikely") : t("compatibility.levelCheck")}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="es-screen-note">{t("home.phone.step1Body")}</p>
              </Slide>

              {featured ? (
                <Slide decorative active={back === "featured"} label="" className="es-app es-app-back">
                  <p className="es-app-label">{t("home.phone.popularPackage")}</p>
                  <div className="es-screen-hero">
                    <DestinationFlag countryCode={featured.countryCode} name={featured.name} coverage={featured.coverage} size="lg" />
                    <div>
                      <h3>{t("home.phone.packagesTitle", { name: featured.name })}</h3>
                      <small>
                        {t("home.phone.plansFrom", {
                          count: featured.planCount,
                          price: formatMoney(featured.fromPriceMinor ?? featured.plan.priceMinor, featured.plan.currency),
                        })}
                      </small>
                    </div>
                  </div>
                  <div className="es-screen-offer">
                    <div className="es-screen-offer-data">
                      <strong dir="ltr">{formatData(featured.plan.dataMb)}</strong>
                      <small>{dayCount(featured.plan.validityDays)}</small>
                    </div>
                    <span className="es-screen-offer-price" dir="ltr">
                      {formatMoney(featured.plan.priceMinor, featured.plan.currency)}
                    </span>
                  </div>
                  {featured.more?.length ? (
                    <div className="es-screen-more">
                      {featured.more.map((plan) => (
                        <div key={plan.slug} className="es-screen-more-row">
                          <strong dir="ltr">{formatData(plan.dataMb)}</strong>
                          <small>{dayCount(plan.validityDays)}</small>
                          <span dir="ltr">{formatMoney(plan.priceMinor, plan.currency)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <ul className="es-screen-ticks">
                    <li>
                      <CheckIcon />
                      <span>{t("home.phone.esimReady")}</span>
                    </li>
                    <li>
                      <CheckIcon />
                      <span>{t("home.phone.step3Body")}</span>
                    </li>
                  </ul>
                  <span className="es-app-cta">
                    <span>{t("common.add")}</span>
                    <ArrowRight />
                  </span>
                </Slide>
              ) : null}

              <Slide decorative active={back === "activation"} label="" className="es-app es-app-back">
                <p className="es-app-label">{t("home.phone.orderActivation")}</p>
                {featured ? (
                  <div className="es-screen-esim">
                    <span className="es-screen-esim-chip" />
                    <div className="es-screen-esim-head">
                      <CountryFlag code={featured.countryCode} label={featured.name} />
                      <strong>{featured.plan.name}</strong>
                    </div>
                    <div className="es-screen-esim-meta">
                      <span dir="ltr">{formatData(featured.plan.dataMb)}</span>
                      <span>{dayCount(featured.plan.validityDays)}</span>
                      <span className="es-screen-esim-ready">
                        <QrIcon />
                        {t("home.phone.esimReady")}
                      </span>
                    </div>
                  </div>
                ) : null}
                <ol className="es-screen-timeline">
                  <li className="is-done">
                    <span className="es-screen-timeline-icon">
                      <CheckIcon />
                    </span>
                    <strong>{t("home.phone.paymentConfirmed")}</strong>
                  </li>
                  <li className="is-done">
                    <span className="es-screen-timeline-icon">
                      <QrIcon />
                    </span>
                    <strong>{t("home.phone.esimReady")}</strong>
                  </li>
                  <li>
                    <span className="es-screen-timeline-icon">
                      <GlobeIcon />
                    </span>
                    <strong>{t("home.phone.dataOnArrival")}</strong>
                  </li>
                </ol>
                <p className="es-app-label">{t("home.phone.supportTitle")}</p>
                <ul className="es-screen-ticks">
                  <li>
                    <CheckIcon />
                    <span>{t("home.phone.refundIncompatible")}</span>
                  </li>
                  <li>
                    <CheckIcon />
                    <span>{t("home.phone.helpGuides")}</span>
                  </li>
                </ul>
              </Slide>
            </div>
            <div className="es-carousel-dots es-carousel-dots-back">
              {backScreens.map((screen, index) => (
                <span key={screen} className={index === backIndex ? "is-active" : ""} />
              ))}
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

            <div className="es-carousel" aria-roledescription="carousel" aria-label={t("home.phone.carouselLabel")}>
              <Slide
                active={front === "explore"}
                label={screenLabel(frontScreens.indexOf("explore") + 1, frontScreens.length)}
                className="es-app"
              >
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
                            <CountryFlag code={item.countryCode} label={item.name} eager />
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
                            <CountryFlag code={item.countryCode} label={item.name} eager />
                          </span>
                          <span className="es-app-row-copy">
                            <strong>{item.name}</strong>
                            <small>
                              <span dir="ltr">{formatData(item.dataMb)}</span> · {dayCount(item.validityDays)}
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
                            {fromLabel(item.fromPriceMinor)}
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
              </Slide>

              {packages.length ? (
                <Slide
                  active={front === "packages"}
                  label={screenLabel(frontScreens.indexOf("packages") + 1, frontScreens.length)}
                  className="es-app"
                >
                  <div className="es-app-head">
                    <div>
                      <h3>{t("home.phone.regionalPackages")}</h3>
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
                  <div className="es-app-tabs" aria-hidden="true">
                    <span>{t("home.phone.country")}</span>
                    <span className="is-active">{t("home.phone.regional")}</span>
                  </div>
                  <p className="es-app-label">{t("home.phone.regions")}</p>
                  <div className="es-app-list es-app-list-regions">
                    {packages.map((item) => (
                      <Link key={item.slug} className="es-app-row" href={href(`/destinations/${item.slug}`)}>
                        <DestinationFlag countryCode={item.countryCode} name={item.name} coverage={item.coverage} size="sm" max={3} />
                        <span className="es-app-row-copy">
                          <strong>{item.name}</strong>
                          <small>
                            {coverageLabel(item)} · {item.planCount} {t("common.plans").toLocaleLowerCase()}
                          </small>
                        </span>
                        <span className="es-app-row-price" dir="ltr">
                          {fromLabel(item.fromPriceMinor)}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link className="es-app-cta" href={href("/regions")}>
                    <span>{t("home.phone.exploreRegions")}</span>
                    <ArrowRight />
                  </Link>
                </Slide>
              ) : null}

              {detail ? (
                <Slide
                  active={front === "detail"}
                  label={screenLabel(frontScreens.indexOf("detail") + 1, frontScreens.length)}
                  className="es-app"
                >
                  <div className="es-screen-hero">
                    <DestinationFlag countryCode={detail.countryCode} name={detail.name} coverage={detail.coverage} size="lg" />
                    <div>
                      <h3>{t("home.phone.packagesTitle", { name: detail.name })}</h3>
                      <small>
                        {t("home.phone.plansFrom", {
                          count: detail.planCount,
                          price: formatMoney(detail.fromPriceMinor ?? detail.plans[0].priceMinor, detail.plans[0].currency),
                        })}
                      </small>
                    </div>
                  </div>
                  <p className="es-app-label">{t("home.phone.chooseData")}</p>
                  <div className="es-screen-plans">
                    {detail.plans.map((plan, index) => (
                      <Link
                        key={plan.slug}
                        className={`es-screen-plan${index === 1 || detail.plans.length === 1 ? " is-selected" : ""}`}
                        href={href(`/plans/${plan.slug}`)}
                      >
                        <strong dir="ltr">{formatData(plan.dataMb)}</strong>
                        <small>{dayCount(plan.validityDays)}</small>
                        <span dir="ltr">{formatMoney(plan.priceMinor, plan.currency)}</span>
                      </Link>
                    ))}
                  </div>
                  <Link className="es-app-cta" href={href(`/destinations/${detail.slug}`)}>
                    <span>{t("home.phone.viewPlans", { name: detail.name })}</span>
                    <ArrowRight />
                  </Link>
                </Slide>
              ) : null}

              {search ? (
                <Slide
                  active={front === "search"}
                  label={screenLabel(frontScreens.indexOf("search") + 1, frontScreens.length)}
                  className="es-app"
                >
                  <div className="es-app-head">
                    <div>
                      <h3>{t("home.phone.searchDestination")}</h3>
                      <p>{t("home.phone.browsePlans")}</p>
                    </div>
                    <span className="es-app-logo" aria-hidden="true">
                      e
                    </span>
                  </div>
                  <div className="es-app-search es-app-search-typed" aria-hidden="true">
                    <SearchIcon />
                    <span>{search.query}</span>
                    <span className="es-app-caret" />
                  </div>
                  <p className="es-app-label">{t("home.phone.results")}</p>
                  <div className="es-app-list es-app-list-regions">
                    {search.results.map((item, index) => (
                      <Link
                        key={item.slug}
                        className={`es-app-row${index === 0 ? " is-selected" : ""}`}
                        href={href(`/destinations/${item.slug}`)}
                      >
                        <DestinationFlag countryCode={item.countryCode} name={item.name} coverage={item.coverage} size="sm" max={2} />
                        <span className="es-app-row-copy">
                          <strong>{item.name}</strong>
                          <small>
                            {index === 0
                              ? `${item.planCount} ${t("common.plans").toLocaleLowerCase()}`
                              : t("home.phone.includes", { name: search.results[0].name })}
                          </small>
                        </span>
                        <span className="es-app-row-price" dir="ltr">
                          {fromLabel(item.fromPriceMinor)}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link className="es-app-cta" href={href(`/destinations/${search.results[0].slug}`)}>
                    <span>{t("home.phone.viewPlans", { name: search.results[0].name })}</span>
                    <ArrowRight />
                  </Link>
                </Slide>
              ) : null}
            </div>

            {frontScreens.length > 1 ? (
              <div className="es-carousel-dots">
                {frontScreens.map((screen, index) => (
                  <button
                    key={screen}
                    type="button"
                    className={index === frontIndex ? "is-active" : ""}
                    aria-label={t("home.phone.showScreen", { number: index + 1 })}
                    aria-current={index === frontIndex ? "true" : undefined}
                    onClick={() => setFrontIndex(index)}
                  />
                ))}
                {!reducedMotion ? (
                  <button
                    type="button"
                    className="es-carousel-toggle"
                    aria-label={userPaused ? t("home.phone.playAnimation") : t("home.phone.pauseAnimation")}
                    aria-pressed={userPaused}
                    onClick={() => setUserPaused((value) => !value)}
                  >
                    <span className={userPaused ? "is-play" : "is-pause"} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}

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
