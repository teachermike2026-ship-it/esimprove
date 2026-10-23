import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";
import { getDestinations, getFeaturedPlans, getRegions } from "@/lib/catalog";
import { DestinationCard } from "@/components/destination-card";
import { PlanCard } from "@/components/plan-card";
import { SearchForm } from "@/components/search-form";
import { formatMoney } from "@/lib/money";
import {
  ArrowRight,
  CheckIcon,
  GlobeIcon,
  LockIcon,
  QrIcon,
  ShieldIcon,
  SignalIcon,
  SparkIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Demo eSIM travel store",
  description:
    "Explore destinations, compare demo eSIM plans, check device compatibility, and walk through a clearly labelled mock checkout.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const db = await getDb();
  const [regions, popularDestinations, featuredPlans] = await Promise.all([
    getRegions(db),
    getDestinations(db, { popular: true }),
    getFeaturedPlans(db, 6),
  ]);
  const planCount = regions.reduce((total, region) => total + region.planCount, 0);
  const destinationCount = regions.reduce((total, region) => total + region.destinationCount, 0);
  const heroPlan = featuredPlans[0];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Demo eSIM travel commerce</p>
          <h1 id="hero-title">
            Travel data, without the <em>roaming guesswork.</em>
          </h1>
          <p className="lead">
            Browse destination-first demo plans, check device compatibility, and follow the
            full order journey — with mock payments and mock provisioning that are clearly
            labelled at every step.
          </p>
          <SearchForm />
          <div className="hero-actions">
            <Link className="button" href="/plans">
              Browse demo plans <ArrowRight className="inline-icon" />
            </Link>
            <Link className="button button-secondary" href="/compatibility">
              Check compatibility
            </Link>
          </div>
          <ul className="hero-trust">
            <li>
              <CheckIcon className="inline-icon" /> {destinationCount} demo destinations
            </li>
            <li>
              <CheckIcon className="inline-icon" /> {planCount} demo plans
            </li>
            <li>
              <CheckIcon className="inline-icon" /> No live money or eSIMs
            </li>
          </ul>
        </div>

        <div className="hero-panel" aria-label="Example demo plan">
          <span className="hero-stamp">
            Demo
            <br />
            catalogue
          </span>
          <div className="hero-card">
            <span className="hero-card-badge">Illustrative plan</span>
            <h2>{heroPlan ? `${heroPlan.destinationName} · ${heroPlan.name}` : "Demo travel plan"}</h2>
            <p>
              {heroPlan
                ? `${heroPlan.coverageSummary}. Real coverage, speed, and network terms require supplier verification.`
                : "A placeholder demo plan. Real supplier data is not connected."}
            </p>
            <div className="hero-card-row">
              <div>
                <span className="price-note">Demo price</span>
                <div className="hero-card-price">
                  {heroPlan ? formatMoney(heroPlan.priceMinor, heroPlan.currency) : "$0.00"}
                </div>
              </div>
              <div className="pill-row">
                <span className="hero-card-badge">QR + manual</span>
                <span className="hero-card-badge">Mock</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="popular-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Start with a destination</p>
            <h2 id="popular-title">Popular demo destinations</h2>
            <p className="muted">
              Each destination page is generated from the local demo catalogue. Prices are
              computed by the pricing engine and are not supplier quotes.
            </p>
          </div>
          <Link className="button button-ghost" href="/destinations">
            All destinations <ArrowRight className="inline-icon" />
          </Link>
        </div>
        <div className="grid grid-4">
          {popularDestinations.slice(0, 8).map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="featured-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Compare the basics</p>
            <h2 id="featured-title">Featured demo plans</h2>
            <p className="muted">
              Data, validity, and price are real fields in the local database. The supplier,
              coverage, and activation values are mock data.
            </p>
          </div>
          <Link className="button button-ghost" href="/plans">
            See all plans <ArrowRight className="inline-icon" />
          </Link>
        </div>
        <div className="grid grid-3">
          {featuredPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">How the demo works</p>
            <h2 id="how-title">A complete local journey, with honest boundaries</h2>
          </div>
        </div>
        <div className="grid grid-4">
          <article className="card stat">
            <GlobeIcon className="inline-icon" />
            <strong>1</strong>
            <span>Choose</span>
            <p className="muted small">
              Pick a destination and compare demo data, validity, and price.
            </p>
          </article>
          <article className="card stat">
            <SignalIcon className="inline-icon" />
            <strong>2</strong>
            <span>Check</span>
            <p className="muted small">
              Use the conservative compatibility guide, then confirm with the manufacturer.
            </p>
          </article>
          <article className="card stat">
            <QrIcon className="inline-icon" />
            <strong>3</strong>
            <span>Install</span>
            <p className="muted small">
              Follow general iOS or Android steps. Demo activation codes cannot connect.
            </p>
          </article>
          <article className="card stat">
            <ShieldIcon className="inline-icon" />
            <strong>4</strong>
            <span>Track</span>
            <p className="muted small">
              See order, payment, fulfillment, and retry states in the customer and admin
              views.
            </p>
          </article>
        </div>
      </section>

      <section className="section" aria-labelledby="regions-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Browse by region</p>
            <h2 id="regions-title">Find a region, then narrow the plan</h2>
          </div>
        </div>
        <div className="grid grid-4">
          {regions.map((region) => (
            <article key={region.id} className={`card stat accent-${region.accent}`}>
              <span className="badge badge-demo">{region.planCount} demo plans</span>
              <h3>
                <Link href={`/regions/${region.slug}`}>{region.name}</Link>
              </h3>
              <p className="muted small">{region.description}</p>
              {region.fromPriceMinor !== null ? (
                <p className="small">
                  From <strong>{formatMoney(region.fromPriceMinor, "USD")}</strong>
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="demo-limits" aria-labelledby="limits-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Honest boundaries</p>
            <h2 id="limits-title">What this build does and does not do</h2>
          </div>
        </div>
        <div className="grid grid-2">
          <article className="card form">
            <h3>
              <CheckIcon className="inline-icon" /> Working locally
            </h3>
            <ul className="check-list">
              <li>
                <CheckIcon className="inline-icon" /> Database schema, migrations, demo seed, and
                catalog queries.
              </li>
              <li>
                <CheckIcon className="inline-icon" /> Pricing engine, cart, idempotent checkout,
                signed mock webhook, fulfillment jobs, encrypted activation storage, and mock
                email logging.
              </li>
              <li>
                <CheckIcon className="inline-icon" /> Customer portal, guest order links, and an
                admin area for orders, jobs, plans, and email logs.
              </li>
            </ul>
          </article>
          <article className="card form">
            <h3>
              <LockIcon className="inline-icon" /> Not live
            </h3>
            <ul className="check-list">
              <li>
                <CheckIcon className="inline-icon" /> No real payment processor, supplier
                account, carrier connection, or funded test deposit.
              </li>
              <li>
                <CheckIcon className="inline-icon" /> No real eSIM, QR activation, coverage,
                speed, price, review, rating, or company claim.
              </li>
              <li>
                <CheckIcon className="inline-icon" /> No real email is sent. The delivery email
                is logged locally and its stored body redacts the access token.
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section" aria-labelledby="cta-title">
        <div className="card form">
          <p className="eyebrow">Try the full flow</p>
          <h2 id="cta-title">Start with a demo plan, then inspect every state.</h2>
          <p className="lead">
            Use the mock payment page to simulate success or failure. The admin area shows the
            resulting order, job, and email records.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/plans">
              <SparkIcon className="inline-icon" /> Browse plans
            </Link>
            <Link className="button button-secondary" href="/admin">
              Open demo admin
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
