import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  getDestinations,
  getPlans,
  getPlansForDestination,
  getRegions,
  type PlanSummary,
} from "@/lib/catalog";
import { formatData, formatMoney } from "@/lib/money";
import { CountryFlag } from "@/components/country-flag";
import { DestinationExplorer, type ExplorerDestination } from "@/components/home/destination-explorer";
import { DestinationSearch } from "@/components/home/destination-search";
import {
  PhoneShowcase,
  type PhoneDestination,
  type PhonePackage,
  type PhonePlan,
  type PhoneRegion,
} from "@/components/home/phone-showcase";
import { isCountryCode, isGlobalCode } from "@/lib/flags";
import { ExampleQr } from "@/components/home/example-qr";
import { TutorialSection } from "@/components/home/tutorial-section";
import { WorldMap } from "@/components/home/world-map";
import { HomeBlogSection } from "@/components/home/blog-section";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { getI18n } from "@/lib/i18n/server";
import {
  ArrowRight,
  CheckIcon,
  GlobeIcon,
  QrIcon,
  ShieldIcon,
  SignalIcon,
  StarIcon,
  PlaneIcon,
  HeadsetIcon,
} from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/",
    title: t("home.metaTitle"),
    description: t("home.metaDescription"),
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const { t, href } = await getI18n();
  const db = await getDb();
  const [regions, destinations, plans] = await Promise.all([
    getRegions(db),
    getDestinations(db),
    getPlans(db, { limit: 500 }),
  ]);

  const destinationCount = destinations.length;
  const regionCount = regions.length;
  const planCount = regions.reduce((total, region) => total + region.planCount, 0);
  const popularDestinations = destinations.filter((destination) => destination.popular);
  const featuredDestinations = [
    ...popularDestinations,
    ...destinations.filter((destination) => !destination.popular),
  ].slice(0, 12);

  const cheapestPlanByDestination = new Map<string, PlanSummary>();
  for (const plan of plans) {
    if (!cheapestPlanByDestination.has(plan.destinationSlug)) {
      cheapestPlanByDestination.set(plan.destinationSlug, plan);
    }
  }

  const explorerDestinations: ExplorerDestination[] = featuredDestinations.map(
    (destination) => {
      const plan = cheapestPlanByDestination.get(destination.slug) ?? null;
      return {
        slug: destination.slug,
        name: destination.name,
        countryCode: destination.countryCode,
        coverage: destination.coverage,
        regionName: destination.regionName,
        planCount: destination.planCount,
        fromPriceMinor: destination.fromPriceMinor,
        fromValidityDays: plan?.validityDays ?? null,
        currency: plan?.currency ?? "USD",
      };
    },
  );

  const explorerRegions = regions.map((region) => ({
    slug: region.slug,
    name: region.name,
    description: region.description,
    destinationCount: region.destinationCount,
    planCount: region.planCount,
    fromPriceMinor: region.fromPriceMinor,
  }));

  const phoneDestinations: PhoneDestination[] = [];
  for (const destination of featuredDestinations.slice(0, 4)) {
    const plan = cheapestPlanByDestination.get(destination.slug);
    if (!plan) continue;
    phoneDestinations.push({
      slug: destination.slug,
      name: destination.name,
      countryCode: destination.countryCode,
      planName: plan.name,
      dataMb: plan.dataMb,
      validityDays: plan.validityDays,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
    });
  }

  const phoneRegions: PhoneRegion[] = regions.map((region) => ({
    slug: region.slug,
    name: region.name,
    destinationCount: region.destinationCount,
    planCount: region.planCount,
    fromPriceMinor: region.fromPriceMinor,
  }));

  // Phone carousel screens — every value below comes from the live catalog.
  const toPackage = (destination: (typeof destinations)[number]): PhonePackage => ({
    slug: destination.slug,
    name: destination.name,
    countryCode: destination.countryCode,
    coverage: destination.coverage ?? [],
    planCount: destination.planCount,
    fromPriceMinor: destination.fromPriceMinor,
  });
  const toPhonePlan = (plan: PlanSummary): PhonePlan => ({
    slug: plan.slug,
    name: plan.name,
    dataMb: plan.dataMb,
    validityDays: plan.validityDays,
    priceMinor: plan.priceMinor,
    currency: plan.currency,
  });
  const multiCountry = destinations.filter((destination) => !isCountryCode(destination.countryCode));
  const largestRegional = multiCountry
    .filter((destination) => !isGlobalCode(destination.countryCode))
    .sort((a, b) => (b.coverage?.length ?? 0) - (a.coverage?.length ?? 0));
  const regionalByArea = new Map<string, (typeof destinations)[number]>();
  for (const destination of largestRegional) {
    if (!regionalByArea.has(destination.regionSlug)) regionalByArea.set(destination.regionSlug, destination);
  }
  const globalPackage = multiCountry
    .filter((destination) => isGlobalCode(destination.countryCode))
    .sort((a, b) => (b.coverage?.length ?? 0) - (a.coverage?.length ?? 0))[0];
  const phonePackages: PhonePackage[] = [
    ...[...regionalByArea.values()].slice(0, globalPackage ? 4 : 5),
    ...(globalPackage ? [globalPackage] : []),
  ].map(toPackage);

  const singleFeatured = featuredDestinations.filter((destination) => isCountryCode(destination.countryCode));
  const detailDestination = singleFeatured[0] ?? null;
  const featuredPackageDestination = singleFeatured[2] ?? singleFeatured[0] ?? null;
  const [detailSource, featuredPackagePlans] = await Promise.all([
    detailDestination ? getPlansForDestination(db, detailDestination.id) : Promise.resolve([]),
    featuredPackageDestination ? getPlansForDestination(db, featuredPackageDestination.id) : Promise.resolve([]),
  ]);
  // Up to six real plans with distinct data allowances, preferring trip-length
  // validity (7+ days) and falling back to the shortest plans if needed.
  const detailPlans: PhonePlan[] = [];
  if (detailDestination) {
    const tripLength = detailSource.filter((plan) => plan.validityDays >= 7);
    const source = tripLength.length >= 4 ? tripLength : detailSource;
    const seenData = new Set<number>();
    for (const plan of [...source].sort((a, b) => a.dataMb - b.dataMb || a.priceMinor - b.priceMinor)) {
      if (seenData.has(plan.dataMb)) continue;
      seenData.add(plan.dataMb);
      detailPlans.push(toPhonePlan(plan));
      if (detailPlans.length === 6) break;
    }
  }

  const coveringPackages = (code: string) =>
    multiCountry
      .filter((destination) => destination.coverage?.includes(code))
      .sort((a, b) => (a.fromPriceMinor ?? Infinity) - (b.fromPriceMinor ?? Infinity));
  const searchDestination =
    singleFeatured.slice(1).find((destination) => coveringPackages(destination.countryCode).length >= 2) ??
    singleFeatured[1] ??
    null;
  const searchResults: PhonePackage[] = searchDestination
    ? [searchDestination, ...coveringPackages(searchDestination.countryCode).slice(0, 4)].map(toPackage)
    : [];

  // A trip-length plan (1 GB+, 7+ days) when the catalog has one; cheapest first.
  const featuredPlan =
    featuredPackagePlans.find((plan) => plan.dataMb >= 1024 && plan.validityDays >= 7) ??
    featuredPackagePlans.find((plan) => plan.dataMb >= 1024) ??
    featuredPackagePlans[0] ??
    null;

  const flexibleDestination = featuredDestinations[0] ?? destinations[0] ?? null;
  const flexiblePlans = flexibleDestination
    ? plans.filter((plan) => plan.destinationSlug === flexibleDestination.slug).slice(0, 3)
    : [];
  const selectedPlanIndex = flexiblePlans.length > 1 ? 1 : 0;
  const flagDestinations = featuredDestinations.slice(0, 6);
  const ctaFlagDestinations = featuredDestinations.slice(0, 4);
  const searchSuggestions = Array.from(
    new Set([
      ...featuredDestinations.map((destination) => destination.name),
      ...regions.map((region) => region.name),
      "5 GB",
      "10 GB",
    ]),
  );

  const faqItems = Array.from({ length: 10 }, (_, index) => ({
    question: t(`faq.q${index + 1}`),
    answer: t(`faq.a${index + 1}`),
  }));

  return (
    <div className="es-home">
      <section className="es-hero" aria-labelledby="hero-title">
        <div className="es-hero-orb es-hero-orb-one" aria-hidden="true" />
        <div className="es-hero-orb es-hero-orb-two" aria-hidden="true" />
        <WorldMap className="es-hero-map" />

        <div className="es-shell es-hero-grid">
          <div className="es-hero-copy">
            <p className="es-hero-badge">
              <PlaneIcon />
              {t("home.hero.badge")}
            </p>
            <h1 id="hero-title" className="es-hero-title">
              <span>{t("home.hero.title1")}</span>
              <span>{t("home.hero.title2")}</span>
              <span>
                {t("home.hero.title3")} <span className="es-hero-accent">{t("home.hero.title3Accent")}</span>
              </span>
            </h1>
            <p className="es-hero-lead">
              {t("home.hero.lead", {
                destinations: destinationCount,
                regions: regionCount,
              })}
            </p>
            <ul className="es-hero-checks">
              <li>
                <span className="es-check-mark">
                  <CheckIcon />
                </span>
                {t("home.hero.benefitInstant")}
              </li>
              <li>
                <span className="es-check-mark">
                  <CheckIcon />
                </span>
                {t("home.explorer.destinationsCount", { count: destinationCount })}
              </li>
              <li>
                <span className="es-check-mark">
                  <CheckIcon />
                </span>
                {t("home.explorer.planOptions", { count: planCount })}
              </li>
            </ul>
            <DestinationSearch id="hero-search" suggestions={searchSuggestions} />
          </div>

          <div className="es-hero-visual">
            <PhoneShowcase
              destinations={phoneDestinations}
              regions={phoneRegions}
              packages={phonePackages}
              detail={
                detailDestination && detailPlans.length > 0
                  ? { ...toPackage(detailDestination), plans: detailPlans }
                  : null
              }
              search={
                searchDestination && searchResults.length > 0
                  ? { query: searchDestination.name.slice(0, Math.min(5, searchDestination.name.length)), results: searchResults }
                  : null
              }
              featured={
                featuredPackageDestination && featuredPlan
                  ? {
                      ...toPackage(featuredPackageDestination),
                      plan: toPhonePlan(featuredPlan),
                      more: featuredPackagePlans
                        .filter((plan) => plan.dataMb > featuredPlan.dataMb && plan.validityDays >= featuredPlan.validityDays)
                        .filter((plan, index, list) => list.findIndex((other) => other.dataMb === plan.dataMb) === index)
                        .slice(0, 2)
                        .map(toPhonePlan),
                    }
                  : null
              }
              destinationCount={destinationCount}
              regionCount={regionCount}
              planCount={planCount}
            />
          </div>
        </div>
      </section>

      <section className="es-trust" aria-label={t("home.trust.label")}>
        <div className="es-shell">
          <h2 className="sr-only">{t("home.trust.title")}</h2>
          <ul className="es-trust-list es-trust-cards">
            <li>
              <QrIcon />
              <span>
                <strong>{t("home.trust.setupTitle")}</strong>
                <small>{t("home.trust.setupText")}</small>
              </span>
            </li>
            <li>
              <GlobeIcon />
              <span>
                <strong>{t("home.explorer.destinationsCount", { count: destinationCount })}</strong>
                <small>{t("home.trust.coverageText", { regions: regionCount })}</small>
              </span>
            </li>
            <li>
              <ShieldIcon />
              <span>
                <strong>{t("home.trust.paymentTitle")}</strong>
                <small>{t("home.trust.paymentText")}</small>
              </span>
            </li>
            <li>
              <SignalIcon />
              <span>
                <strong>{t("home.explorer.planOptions", { count: planCount })}</strong>
                <small>{t("home.trust.plansText")}</small>
              </span>
            </li>
            <li>
              <HeadsetIcon />
              <span>
                <strong>{t("home.trust.supportTitle")}</strong>
                <small>{t("home.trust.supportText")}</small>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="es-intro" aria-labelledby="intro-title">
        <div className="es-shell">
          <h2 id="intro-title" className="es-intro-heading">
            <span>{t("home.intro.title")}</span> {t("home.intro.body")}
          </h2>
          <p>{t("home.intro.body2")}</p>
        </div>
      </section>

      <section className="es-features" aria-labelledby="features-title">
        <div className="es-shell">
          <h2 id="features-title" className="visually-hidden">
            {t("home.features.title")}
          </h2>
          <div className="es-feature-grid">
            <article className="es-feature-card">
              <h3>{t("home.features.globalTitle")}</h3>
              <p>
                {t("home.features.globalBody", {
                  destinations: destinationCount,
                  regions: regionCount,
                })}
              </p>
              <div className="es-flag-cloud" aria-hidden="true">
                {flagDestinations.map((destination) => (
                  <span key={destination.slug} className="es-flag-chip">
                    <CountryFlag code={destination.countryCode} label={destination.name} />
                  </span>
                ))}
                <span className="es-flag-orbit" />
              </div>
              <Link className="es-text-link" href={href("/destinations")}>
                {t("home.features.browse")} <ArrowRight />
              </Link>
            </article>

            <article className="es-feature-card">
              <h3>{t("home.features.flexibleTitle")}</h3>
              <p>{t("home.features.flexibleBody")}</p>
              <div className="es-plan-choice">
                {flexiblePlans.map((plan, index) => (
                  <Link
                    key={plan.id}
                    href={href(`/plans/${plan.slug}`)}
                    className={`es-plan-option${index === selectedPlanIndex ? " is-selected" : ""}`}
                  >
                    <span className="es-plan-radio" aria-hidden="true" />
                    <span className="es-plan-option-copy">
                      <strong>
                        <span dir="ltr">{formatData(plan.dataMb)}</span> ·{" "}
                        {plan.validityDays} {t("common.days")}
                      </strong>
                      <small>{plan.destinationName}</small>
                    </span>
                    <strong className="es-plan-option-price" dir="ltr">
                      {formatMoney(plan.priceMinor, plan.currency)}
                    </strong>
                  </Link>
                ))}
              </div>
              {flexibleDestination ? (
                <Link
                  className="es-text-link"
                  href={href(`/destinations/${flexibleDestination.slug}`)}
                >
                  {t("home.features.seePlans", { country: flexibleDestination.name })}{" "}
                  <ArrowRight />
                </Link>
              ) : null}
            </article>

            <article className="es-feature-card">
              <h3>{t("home.features.instantTitle")}</h3>
              <p>{t("home.features.instantBody")}</p>
              <div className="es-qr-panel">
                <ExampleQr />
                <span>{t("home.features.installWithQr")}</span>
              </div>
              <Link className="es-text-link" href={href("/guides")}>
                {t("home.features.openGuide")} <ArrowRight />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="es-destinations" id="destinations" aria-labelledby="destinations-title">
        <div className="es-shell">
          <header className="es-section-head es-section-head-center">
            <p className="es-eyebrow">{t("home.destinations.eyebrow")}</p>
            <h2 id="destinations-title">
              {t("home.destinations.title")}{" "}
              <span className="es-green">{t("home.destinations.titleGreen")}</span>
            </h2>
            <p>{t("home.destinations.body")}</p>
          </header>
          <DestinationExplorer destinations={explorerDestinations} regions={explorerRegions} />
        </div>
      </section>

      <section className="es-install" id="install" aria-labelledby="install-title">
        <div className="es-shell">
          <header className="es-section-head es-section-head-center">
            <p className="es-eyebrow">{t("home.install.eyebrow")}</p>
            <h2 id="install-title">
              {t("home.install.title")}{" "}
              <span className="es-green">{t("home.install.titleGreen")}</span>
            </h2>
            <p>{t("home.install.body")}</p>
          </header>
          <TutorialSection />
        </div>
      </section>

      <section className="es-reviews" aria-labelledby="reviews-title">
        <div className="es-shell">
          <div className="es-reviews-head">
            <h2 id="reviews-title">
              {t("home.reviews.title")}{" "}
              <span className="es-green">{t("home.reviews.titleGreen")}</span>
            </h2>
            <p>{t("home.reviews.body")}</p>
          </div>

          <div className="es-reviews-empty">
            <span className="es-reviews-icon" aria-hidden="true">
              <StarIcon />
            </span>
            <div>
              <h3>{t("home.reviews.emptyTitle")}</h3>
              <p>{t("home.reviews.emptyBody")}</p>
            </div>
            <Link className="es-text-link" href={href("/about#reviews")}>
              {t("home.reviews.policyLink")} <ArrowRight />
            </Link>
          </div>

          <ul className="es-review-principles">
            <li>
              <span>01</span>
              <strong>{t("home.reviews.principle1Title")}</strong>
              <p>{t("home.reviews.principle1Body")}</p>
            </li>
            <li>
              <span>02</span>
              <strong>{t("home.reviews.principle2Title")}</strong>
              <p>{t("home.reviews.principle2Body")}</p>
            </li>
            <li>
              <span>03</span>
              <strong>{t("home.reviews.principle3Title")}</strong>
              <p>{t("home.reviews.principle3Body")}</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="es-faq" id="faq" aria-labelledby="faq-title">
        <div className="es-shell es-faq-layout">
          <div className="es-faq-intro">
            <p className="es-eyebrow">{t("home.faq.eyebrow")}</p>
            <h2 id="faq-title">
              {t("home.faq.title")}{" "}
              <span className="es-green">{t("home.faq.titleGreen")}</span>
            </h2>
            <p>{t("home.faq.body")}</p>
            <Link className="es-text-link" href={href("/guides")}>
              {t("home.faq.link")} <ArrowRight />
            </Link>
          </div>

          <div className="es-faq-list">
            {faqItems.map((item, index) => (
              <details key={item.question} className="es-faq-item" open={index === 0}>
                <summary>
                  <span>{item.question}</span>
                  <span className="es-faq-plus" aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="es-cta" aria-labelledby="cta-title">
        <div className="es-shell">
          <div className="es-cta-panel">
            <div className="es-cta-copy">
              <p className="es-eyebrow">{t("home.cta.eyebrow")}</p>
              <h2 id="cta-title">
                {t("home.cta.title")}{" "}
                <span className="es-green">{t("home.cta.titleGreen")}</span>
              </h2>
              <p>{t("home.cta.body")}</p>
              <DestinationSearch id="cta-search" suggestions={searchSuggestions} size="cta" />
              <div className="es-cta-actions">
                <Link className="es-button es-button-primary" href={href("/destinations")}>
                  {t("home.cta.browseAll")} <ArrowRight />
                </Link>
                <Link className="es-button es-button-secondary" href={href("/plans")}>
                  {t("home.cta.compare")}
                </Link>
              </div>
            </div>

            <div className="es-cta-art" aria-hidden="true">
              <span className="es-cta-orbit es-cta-orbit-one" />
              <span className="es-cta-orbit es-cta-orbit-two" />
              <span className="es-cta-globe">
                <GlobeIcon />
              </span>
              {ctaFlagDestinations.map((destination, index) => (
                <span
                  key={destination.slug}
                  className={`es-cta-flag es-cta-flag-${index + 1}`}
                >
                  <CountryFlag code={destination.countryCode} label={destination.name} />
                </span>
              ))}
              <span className="es-cta-pill">
                <CheckIcon /> {t("home.cta.pill", { count: destinationCount })}
              </span>
            </div>
          </div>
        </div>
      </section>

      <HomeBlogSection />
    </div>
  );
}
