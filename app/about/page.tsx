import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getRegions } from "@/lib/catalog";
import { ArrowRight, CheckIcon, GlobeIcon, LockIcon, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how the Esimprove demo storefront works, what is implemented, and which claims and integrations remain deliberately unavailable.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const db = await getDb();
  const regions = await getRegions(db);
  const regionCount = regions.length;
  const destinationCount = regions.reduce(
    (total, region) => total + region.destinationCount,
    0,
  );

  return (
    <div className="es-page">
      <section className="es-page-hero" aria-labelledby="about-title">
        <p className="es-eyebrow">About Esimprove</p>
        <h1 id="about-title">
          Travel freely. <span className="es-green">Connect instantly.</span>
        </h1>
        <p className="es-page-lead">
          Esimprove is a travel eSIM storefront built around destination-first browsing, clear
          plan details, and honest labels. This build is a working demonstration — not a live
          reseller.
        </p>
        <div className="es-page-actions">
          <Link className="es-button es-button-primary" href="/destinations">
            Browse destinations <ArrowRight />
          </Link>
          <Link className="es-button es-button-secondary" href="/contact">
            Contact and support
          </Link>
        </div>
      </section>

      <section className="es-page-section" id="how-it-works" aria-labelledby="how-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">How it works</p>
          <h2 id="how-title">A complete local journey, with clear boundaries</h2>
          <p>
            The catalogue, cart, checkout, customer portal, admin views, and fulfilment
            simulation all run locally. Live commercial and carrier integrations stay off.
          </p>
        </div>
        <div className="es-page-grid es-page-grid-3">
          <article className="es-static-card">
            <span className="es-static-icon">
              <GlobeIcon />
            </span>
            <h3>Destination-first catalogue</h3>
            <p>
              Browse actual demo records for {destinationCount} destinations across{" "}
              {regionCount} regions, with plan data, validity, and pricing computed by the
              local pricing engine.
            </p>
          </article>
          <article className="es-static-card">
            <span className="es-static-icon">
              <ShieldIcon />
            </span>
            <h3>Clearly labelled checkout</h3>
            <p>
              Payments are simulated, no card data is stored, and no real eSIM is provisioned.
              Every order state is visible in the customer and admin areas.
            </p>
          </article>
          <article className="es-static-card">
            <span className="es-static-icon">
              <LockIcon />
            </span>
            <h3>No unverified claims</h3>
            <p>
              No partner logos, live coverage promises, review scores, customer counts, discounts,
              or company contact details are invented for this build.
            </p>
          </article>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="approach-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">Our approach</p>
          <h2 id="approach-title">What changes before launch</h2>
        </div>
        <div className="es-page-split">
          <div className="es-static-card">
            <h3>
              <CheckIcon /> Working today
            </h3>
            <ul className="es-check-list">
              <li>Catalogue search, destination pages, region pages, and plan filters.</li>
              <li>Cart, idempotent demo checkout, mock payment states, and fulfilment jobs.</li>
              <li>Customer portal, guest order links, admin order and email views.</li>
              <li>Device compatibility guidance and provider-neutral installation guides.</li>
            </ul>
          </div>
          <div className="es-static-card">
            <h3>
              <LockIcon /> Required before launch
            </h3>
            <ul className="es-check-list">
              <li>A verified supplier catalogue, live prices, and real coverage terms.</li>
              <li>A live payment provider, managed database, transactional email, and monitoring.</li>
              <li>Approved legal policies, company details, support channels, and refund terms.</li>
              <li>Verified reviews and partner permissions before publishing either.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="es-page-section" id="reviews" aria-labelledby="reviews-policy-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">Reviews policy</p>
          <h2 id="reviews-policy-title">Real stories, or no stories</h2>
          <p>
            No customer reviews, names, ratings, review counts, or platform scores are displayed
            in this build. The testimonials section shows an empty state until genuine reviews
            are approved.
          </p>
        </div>
        <div className="es-static-card">
          <h3>What we will require</h3>
          <ul className="es-check-list">
            <li>Evidence that the review came from a real customer, with permission to publish.</li>
            <li>The review text kept in context, including the date and destination when provided.</li>
            <li>A visible source link when a third-party review platform is used.</li>
            <li>A correction or removal process for inaccurate or withdrawn reviews.</li>
          </ul>
          <p className="es-muted-note">
            No review platform is connected, so no rating badge or “read more reviews” link is
            shown.
          </p>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="company-title">
        <div className="es-static-cta">
          <div>
            <h2 id="company-title">Questions about this build?</h2>
            <p>
              The Contact page explains which support routes are available and which are not
              connected yet. No company address, registration number, phone number, or support
              email is invented here.
            </p>
          </div>
          <Link className="es-button es-button-primary" href="/contact">
            Go to Contact <ArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}
