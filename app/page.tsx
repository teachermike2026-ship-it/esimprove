import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  getDestinations,
  getPlans,
  getRegions,
  type PlanSummary,
} from "@/lib/catalog";
import { formatData, formatMoney } from "@/lib/money";
import { faqItems } from "@/lib/site-content";
import { CountryFlag } from "@/components/country-flag";
import { DestinationExplorer, type ExplorerDestination } from "@/components/home/destination-explorer";
import { DestinationSearch } from "@/components/home/destination-search";
import { PhoneShowcase, type PhoneDestination, type PhoneRegion } from "@/components/home/phone-showcase";
import { ExampleQr } from "@/components/home/example-qr";
import { TutorialSection } from "@/components/home/tutorial-section";
import { WorldMap } from "@/components/home/world-map";
import {
  ArrowRight,
  CheckIcon,
  GlobeIcon,
  QrIcon,
  ShieldIcon,
  SignalIcon,
  StarIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: { absolute: "Travel eSIMs for your next trip · Esimprove" },
  description:
    "Compare travel eSIM plans by destination. Explore data, validity, and pricing in the Esimprove storefront.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
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

  return (
    <div className="es-home">
      <section className="es-hero" aria-labelledby="hero-title">
        <div className="es-hero-orb es-hero-orb-one" aria-hidden="true" />
        <div className="es-hero-orb es-hero-orb-two" aria-hidden="true" />
        <WorldMap className="es-hero-map" />

        <div className="es-shell es-hero-grid">
          <div className="es-hero-copy">
            <h1 id="hero-title" className="es-hero-title">
              <span>Travel Freely</span>
              <span>Connect Instantly</span>
              <span className="es-hero-accent">Anywhere, Anytime</span>
            </h1>
            <p className="es-hero-lead">
              Compare travel eSIM plans for {destinationCount} destinations across{" "}
              {regionCount} regions. Clear data, validity, and pricing up front — no plastic
              SIM, no roaming guesswork.
            </p>
            <DestinationSearch id="hero-search" suggestions={searchSuggestions} />
            <ul className="es-hero-checks">
              <li>
                <span className="es-check-mark">
                  <CheckIcon />
                </span>
                {destinationCount} destinations
              </li>
              <li>
                <span className="es-check-mark">
                  <CheckIcon />
                </span>
                {regionCount} regions
              </li>
              <li>
                <span className="es-check-mark">
                  <CheckIcon />
                </span>
                {planCount} plan options
              </li>
            </ul>
          </div>

          <div className="es-hero-visual">
            <PhoneShowcase
              destinations={phoneDestinations}
              regions={phoneRegions}
              destinationCount={destinationCount}
              regionCount={regionCount}
              planCount={planCount}
            />
          </div>
        </div>
      </section>

      <section className="es-trust" aria-label="Coverage overview">
        <div className="es-shell">
          <p className="es-trust-title">Coverage built for international travel</p>
          <ul className="es-trust-list">
            <li>
              <GlobeIcon />
              <span>{destinationCount} destinations</span>
            </li>
            <li>
              <SignalIcon />
              <span>{regionCount} regions</span>
            </li>
            <li>
              <QrIcon />
              <span>{planCount} plan options</span>
            </li>
            <li>
              <ShieldIcon />
              <span>Digital delivery</span>
            </li>
            <li>
              <CheckIcon />
              <span>Clear status labels</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="es-intro" aria-labelledby="intro-title">
        <div className="es-shell">
          <h2 id="intro-title" className="es-intro-heading">
            <span>Esimprove: Always Connected.</span> Instant travel data, no plastic SIM —
            simple, digital connectivity for your next trip.
          </h2>
          <p>
            Browse plans by destination, compare data and validity, and check your device
            before you travel.
          </p>
        </div>
      </section>

      <section className="es-features" aria-labelledby="features-title">
        <div className="es-shell">
          <h2 id="features-title" className="visually-hidden">
            What Esimprove offers
          </h2>
          <div className="es-feature-grid">
            <article className="es-feature-card">
              <h3>Global Coverage</h3>
              <p>
                Explore {destinationCount} destinations across {regionCount} regions,
                with data, validity, and starting prices shown up front.
              </p>
              <div className="es-flag-cloud" aria-hidden="true">
                {flagDestinations.map((destination) => (
                  <span key={destination.slug} className="es-flag-chip">
                    <CountryFlag code={destination.countryCode} label={destination.name} />
                  </span>
                ))}
                <span className="es-flag-orbit" />
              </div>
              <Link className="es-text-link" href="/destinations">
                Browse destinations <ArrowRight />
              </Link>
            </article>

            <article className="es-feature-card">
              <h3>Flexible Plans</h3>
              <p>
                Choose from data plans sized for a short break or a longer stay. The
                selected row is the clear, green choice.
              </p>
              <div className="es-plan-choice">
                {flexiblePlans.map((plan, index) => (
                  <Link
                    key={plan.id}
                    href={`/plans/${plan.slug}`}
                    className={`es-plan-option${index === selectedPlanIndex ? " is-selected" : ""}`}
                  >
                    <span className="es-plan-radio" aria-hidden="true" />
                    <span className="es-plan-option-copy">
                      <strong>
                        {formatData(plan.dataMb)} · {plan.validityDays} days
                      </strong>
                      <small>{plan.destinationName}</small>
                    </span>
                    <strong className="es-plan-option-price">
                      {formatMoney(plan.priceMinor, plan.currency)}
                    </strong>
                  </Link>
                ))}
              </div>
              {flexibleDestination ? (
                <Link
                  className="es-text-link"
                  href={`/destinations/${flexibleDestination.slug}`}
                >
                  See {flexibleDestination.name} plans <ArrowRight />
                </Link>
              ) : null}
            </article>

            <article className="es-feature-card">
              <h3>Instant Activation</h3>
              <p>
                QR or manual installation instructions, with a written guide for iOS and
                Android.
              </p>
              <div className="es-qr-panel">
                <ExampleQr />
                <span>Install with a QR code or manual activation code.</span>
              </div>
              <Link className="es-text-link" href="/guides">
                Open install guide <ArrowRight />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="es-destinations" id="destinations" aria-labelledby="destinations-title">
        <div className="es-shell">
          <header className="es-section-head es-section-head-center">
            <p className="es-eyebrow">Find your next stop</p>
            <h2 id="destinations-title">
              Pick a Vacation <span className="es-green">Destination</span>
            </h2>
            <p>
              Choose a destination to explore available packages, data allowances, and
              pricing before you compare plans.
            </p>
          </header>
          <DestinationExplorer destinations={explorerDestinations} regions={explorerRegions} />
        </div>
      </section>

      <section className="es-install" id="install" aria-labelledby="install-title">
        <div className="es-shell">
          <header className="es-section-head es-section-head-center">
            <p className="es-eyebrow">From code to connection</p>
            <h2 id="install-title">
              How to <span className="es-green">Install eSIM</span>
            </h2>
            <p>
              A clear, provider-neutral walkthrough for checking compatibility, installing
              your plan, and labelling the line.
            </p>
          </header>
          <TutorialSection />
        </div>
      </section>

      <section className="es-reviews" aria-labelledby="reviews-title">
        <div className="es-shell">
          <div className="es-reviews-head">
            <h2 id="reviews-title">
              Traveler <span className="es-green">stories</span>
            </h2>
            <p>
              We only publish verified customer reviews. None are published yet, so no review
              names, quotes, ratings, or platform scores are shown.
            </p>
          </div>

          <div className="es-reviews-empty">
            <span className="es-reviews-icon" aria-hidden="true">
              <StarIcon />
            </span>
            <div>
              <h3>No reviews published yet</h3>
              <p>
                When real, approved reviews are available, this section will show the review,
                date, destination, and source. We do not invent customer identities or ratings.
              </p>
            </div>
            <Link className="es-text-link" href="/about#reviews">
              Read our review policy <ArrowRight />
            </Link>
          </div>

          <ul className="es-review-principles">
            <li>
              <span>01</span>
              <strong>Real reviews only</strong>
              <p>Published with permission and kept in context.</p>
            </li>
            <li>
              <span>02</span>
              <strong>Source and date shown</strong>
              <p>Every future review will be traceable and dated.</p>
            </li>
            <li>
              <span>03</span>
              <strong>No invented ratings</strong>
              <p>No star score, review count, or platform badge without data.</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="es-faq" id="faq" aria-labelledby="faq-title">
        <div className="es-shell es-faq-layout">
          <div className="es-faq-intro">
            <p className="es-eyebrow">Before you go</p>
            <h2 id="faq-title">
              Frequently asked <span className="es-green">questions</span>
            </h2>
            <p>
              Straight answers about eSIMs, compatibility, and installation.
            </p>
            <Link className="es-text-link" href="/guides">
              Read the installation guides <ArrowRight />
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
              <p className="es-eyebrow">Start with a destination</p>
              <h2 id="cta-title">
                Where are you <span className="es-green">heading next?</span>
              </h2>
              <p>
                Search the catalogue, then compare data, validity, and price before you
                choose a plan.
              </p>
              <DestinationSearch id="cta-search" suggestions={searchSuggestions} size="cta" />
              <div className="es-cta-actions">
                <Link className="es-button es-button-primary" href="/destinations">
                  Browse all destinations <ArrowRight />
                </Link>
                <Link className="es-button es-button-secondary" href="/plans">
                  Compare plans
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
                <CheckIcon /> {destinationCount} destinations
              </span>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
