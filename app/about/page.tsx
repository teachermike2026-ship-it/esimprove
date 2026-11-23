import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getRegions } from "@/lib/catalog";
import { ArrowRight, GlobeIcon, LockIcon, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how Esimprove works — destination-first travel eSIM plans, transparent pricing, and how your eSIM is delivered and installed.",
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
          plan details, and transparent pricing.
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
          <h2 id="how-title">How your eSIM journey works</h2>
          <p>
            Browse destinations, compare plans, check out, and install your eSIM when it is
            delivered — from first search to connected in a few clear steps.
          </p>
        </div>
        <div className="es-page-grid es-page-grid-3">
          <article className="es-static-card">
            <span className="es-static-icon">
              <GlobeIcon />
            </span>
            <h3>Destination-first catalogue</h3>
            <p>
              Compare plans for {destinationCount} destinations across {regionCount} regions, with
              data, validity, and pricing shown for every option.
            </p>
          </article>
          <article className="es-static-card">
            <span className="es-static-icon">
              <ShieldIcon />
            </span>
            <h3>Simple, transparent checkout</h3>
            <p>
              Prices are shown up front with no hidden fees, and card details are never stored
              on our site. Your order status is always visible in your account.
            </p>
          </article>
          <article className="es-static-card">
            <span className="es-static-icon">
              <LockIcon />
            </span>
            <h3>No unverified claims</h3>
            <p>
              No partner logos, live coverage promises, review scores, customer counts, discounts,
              or company contact details are invented.
            </p>
          </article>
        </div>
      </section>

      <section className="es-page-section" id="reviews" aria-labelledby="reviews-policy-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">Reviews policy</p>
          <h2 id="reviews-policy-title">Real stories, or no stories</h2>
          <p>
            No customer reviews, names, ratings, review counts, or platform scores are displayed
            today. The testimonials section shows an empty state until genuine reviews are
            approved.
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
            Until a review platform is connected and reviews are verified, no rating badge or
            “read more reviews” link is shown.
          </p>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="company-title">
        <div className="es-static-cta">
          <div>
            <h2 id="company-title">Questions about ESIMPROVE?</h2>
            <p>
              The Contact page explains how to reach us and what to include in your message.
              We&apos;ll help with orders, eSIM setup, refunds, and privacy requests.
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
