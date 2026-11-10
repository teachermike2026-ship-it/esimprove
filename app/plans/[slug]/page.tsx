import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getPlanBySlug, getPlansForDestination } from "@/lib/catalog";
import { addToCartAction } from "@/app/actions/cart";
import { formatData, formatMoney } from "@/lib/money";
import { canonicalUrl } from "@/lib/config";
import {
  ArrowRight,
  CartIcon,
  CheckIcon,
  ClockIcon,
  GlobeIcon,
  QrIcon,
  ShieldIcon,
  SignalIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDb();
  const plan = await getPlanBySlug(db, slug);
  if (!plan) return { title: "Plan not found" };
  return {
    title: `${plan.destinationName} ${plan.name} demo plan`,
    description: plan.description,
    alternates: { canonical: canonicalUrl(`/plans/${plan.slug}`) },
  };
}

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const plan = await getPlanBySlug(db, slug);
  if (!plan) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const related = (await getPlansForDestination(db, plan.destinationId)).filter(
    (item) => item.id !== plan.id,
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Plans", item: canonicalUrl("/plans") },
      {
        "@type": "ListItem",
        position: 2,
        name: plan.destinationName,
        item: canonicalUrl(`/destinations/${plan.destinationSlug}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: plan.name,
        item: canonicalUrl(`/plans/${plan.slug}`),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/plans">Plans</Link>
          </li>
          <li>
            <Link href={`/destinations/${plan.destinationSlug}`}>{plan.destinationName}</Link>
          </li>
          <li aria-current="page">{plan.name}</li>
        </ol>
      </nav>

      <div className="split">
        <div className="stack">
          <section className={`card plan-detail accent-${plan.accent}`}>
            <p className="eyebrow">
              {plan.destinationName} · {plan.regionName}
            </p>
            <div className="plan-detail-head">
              <div>
                <h1>{plan.name}</h1>
                <p className="lead">{plan.description}</p>
              </div>
              <span className="badge badge-demo">Demo plan</span>
            </div>
            <div className="plan-detail-stats">
              <div>
                <strong>{formatData(plan.dataMb)}</strong>
                <span>Data</span>
              </div>
              <div>
                <strong>{plan.validityDays} days</strong>
                <span>Validity</span>
              </div>
              <div>
                <strong>{plan.coverageSummary}</strong>
                <span>Coverage label</span>
              </div>
            </div>
            <div className="callout callout-warning">
              <ShieldIcon className="inline-icon" />
              <p>
                This plan is illustrative. Coverage, network quality, speed, fair-use limits,
                and availability have not been verified with a supplier or carrier.
              </p>
            </div>
          </section>

          <section className="card form" aria-labelledby="plan-included">
            <h2 id="plan-included">What the demo includes</h2>
            <ul className="check-list">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <CheckIcon className="inline-icon" /> {feature}
                </li>
              ))}
              <li>
                <CheckIcon className="inline-icon" /> A mock QR code and manual LPA stored with
                envelope encryption after mock payment.
              </li>
            </ul>
          </section>

          <section className="card form" aria-labelledby="plan-before">
            <h2 id="plan-before">Before you install</h2>
            <div className="grid grid-2">
              <div className="stack-sm">
                <h3>
                  <SignalIcon className="inline-icon" /> Check the device
                </h3>
                <p className="muted small">
                  Confirm eSIM support and that the device is carrier-unlocked. The demo
                  compatibility checker is deliberately conservative.
                </p>
                <Link className="button button-ghost button-small" href="/compatibility">
                  Check compatibility <ArrowRight className="inline-icon" />
                </Link>
              </div>
              <div className="stack-sm">
                <h3>
                  <QrIcon className="inline-icon" /> Read the install guide
                </h3>
                <p className="muted small">
                  Installation steps vary by device and OS. Use the general guide as a
                  checklist, not a guarantee.
                </p>
                <Link className="button button-ghost button-small" href="/guides">
                  Open install guides <ArrowRight className="inline-icon" />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <aside className="checkout-sidebar" aria-label="Purchase demo plan">
          <section className="card summary-card">
            <span className="badge badge-demo">Mock purchase</span>
            <div className="price-block" style={{ marginTop: "0.7rem" }}>
              <span className="price">{formatMoney(plan.priceMinor, plan.currency)}</span>
              <span className="price-note">demo price · USD</span>
            </div>
            <div className="summary-row">
              <span>Data</span>
              <span>{formatData(plan.dataMb)}</span>
            </div>
            <div className="summary-row">
              <span>Validity</span>
              <span>{plan.validityDays} days</span>
            </div>
            <div className="summary-row">
              <span>Activation</span>
              <span>QR + manual (mock)</span>
            </div>
            <div className="summary-row">
              <span>Payment</span>
              <span>Mock sandbox</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span>{formatMoney(plan.priceMinor, plan.currency)}</span>
            </div>
            <div className="stack-sm" style={{ marginTop: "1rem" }}>
              <form action={addToCartAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="quantity" value="1" />
                <input type="hidden" name="checkout" value="1" />
                <button className="button button-wide" type="submit">
                  <CartIcon className="inline-icon" /> Buy demo plan
                </button>
              </form>
              <form action={addToCartAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="quantity" value="1" />
                <button className="button button-secondary button-wide" type="submit">
                  Add to cart
                </button>
              </form>
            </div>
            <p className="form-note">
              <ClockIcon className="inline-icon" /> No real payment will be taken. The next
              screen creates a mock payment session.
            </p>
          </section>
          <section className="card summary-card">
            <h2>
              <GlobeIcon className="inline-icon" /> Need another destination?
            </h2>
            <p className="muted small">
              Browse the demo catalogue or search by country, region, or data amount.
            </p>
            <Link className="button button-ghost button-small" href="/plans">
              All demo plans <ArrowRight className="inline-icon" />
            </Link>
          </section>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="section" aria-labelledby="related-plans">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Same destination</p>
              <h2 id="related-plans">Compare other demo plans</h2>
            </div>
          </div>
          <div className="grid grid-3">
            {related.map((item) => (
              <article key={item.id} className={`card plan-card accent-${item.accent}`}>
                <div className="plan-card-top">
                  <div>
                    <p className="eyebrow">{item.name}</p>
                    <h3>
                      <Link href={`/plans/${item.slug}`}>{formatData(item.dataMb)} for {item.validityDays} days</Link>
                    </h3>
                  </div>
                  <span className="badge badge-demo">Demo</span>
                </div>
                <div className="plan-card-bottom">
                  <span className="price">{formatMoney(item.priceMinor, item.currency)}</span>
                  <Link className="button button-ghost button-small" href={`/plans/${item.slug}`}>
                    Details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
