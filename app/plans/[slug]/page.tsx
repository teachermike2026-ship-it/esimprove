import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getPlanBySlug, getPlansForDestination } from "@/lib/catalog";
import { addToCartAction } from "@/app/actions/cart";
import { formatData, formatMoney } from "@/lib/money";
import { siteUrl } from "@/lib/config";
import { absoluteLocalizedUrl } from "@/lib/i18n/config";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { getI18n } from "@/lib/i18n/server";
import {
  demoPlan,
  demoProductEnabled,
  isDemoProductSlug,
} from "@/lib/demo-plan";
import {
  AlertIcon,
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
  const { t } = await getI18n();
  if (demoProductEnabled() && isDemoProductSlug(slug)) {
    return localizedMetadata({
      path: `/plans/${demoPlan.slug}`,
      title: t("demo.metaTitle"),
      description: t("demo.metaDescription"),
      robots: { index: false, follow: false },
    });
  }
  const db = await getDb();
  const plan = await getPlanBySlug(db, slug);
  if (!plan) notFound();
  return localizedMetadata({
    path: `/plans/${plan.slug}`,
    title: t("catalog.planMetaTitle", { country: plan.destinationName, plan: plan.name }),
    description: plan.description || t("catalog.planDescription", { country: plan.destinationName }),
  });
}

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, href, locale } = await getI18n();
  const demo = demoProductEnabled() && isDemoProductSlug(slug);
  const plan = demo ? demoPlan : await getPlanBySlug(await getDb(), slug);
  if (!plan) notFound();
  const nonce = demo ? undefined : ((await headers()).get("x-nonce") ?? undefined);
  const related = demo
    ? []
    : (await getPlansForDestination(await getDb(), plan.destinationId)).filter(
        (item) => item.id !== plan.id,
      );
  const features = demo
    ? [t("demo.featureLocal"), t("demo.featureNoSupplier"), t("demo.featureNoPayment")]
    : [...plan.features, t("catalog.installIncluded")];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("nav.plans"),
        item: absoluteLocalizedUrl("/plans", locale, siteUrl),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: plan.destinationName,
        item: absoluteLocalizedUrl(`/destinations/${plan.destinationSlug}`, locale, siteUrl),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: plan.name,
        item: absoluteLocalizedUrl(`/plans/${plan.slug}`, locale, siteUrl),
      },
    ],
  };

  return (
    <>
      {!demo ? (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      ) : null}
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/plans")}>{t("nav.plans")}</Link>
          </li>
          <li>
            <Link
              href={href(
                demo
                  ? `/plans?region=${plan.regionSlug}`
                  : `/destinations/${plan.destinationSlug}`,
              )}
            >
              {plan.destinationName}
            </Link>
          </li>
          <li aria-current="page">{plan.name}</li>
        </ol>
      </nav>

      <div className="split">
        <div className="stack">
          <section className={`card plan-detail accent-${plan.accent}`}>
            {demo ? (
              <p>
                <span className="badge badge-demo">{t("demo.badge")}</span>
              </p>
            ) : null}
            <p className="eyebrow">
              {plan.destinationName} · {plan.regionName}
            </p>
            <div className="plan-detail-head">
              <div>
                <h1>{plan.name}</h1>
                <p className="lead">
                  {demo ? t("demo.shortDescription") : plan.description}
                </p>
              </div>
            </div>
            <div className="plan-detail-stats">
              <div>
                <strong dir="ltr">{formatData(plan.dataMb)}</strong>
                <span>{t("catalog.data")}</span>
              </div>
              <div>
                <strong dir="ltr">
                  {plan.validityDays} {t("common.days")}
                </strong>
                <span>{t("catalog.validity")}</span>
              </div>
              <div>
                <strong>{demo ? t("demo.coverageValue") : plan.coverageSummary}</strong>
                <span>{t("catalog.coverageLabel")}</span>
              </div>
            </div>
            {demo ? (
              <div className="callout callout-warning">
                <AlertIcon className="inline-icon" />
                <p>{t("demo.detailDescription")}</p>
              </div>
            ) : (
              <div className="callout">
                <ShieldIcon className="inline-icon" />
                <p>{t("catalog.coverageNote")}</p>
              </div>
            )}
          </section>

          <section className="card form" aria-labelledby="plan-included">
            <h2 id="plan-included">{t("catalog.includesTitle")}</h2>
            <ul className="check-list">
              {features.map((feature) => (
                <li key={feature}>
                  <CheckIcon className="inline-icon" /> {feature}
                </li>
              ))}
            </ul>
          </section>

          <section className="card form" aria-labelledby="plan-before">
            <h2 id="plan-before">{t("catalog.beforeInstall")}</h2>
            <div className="grid grid-2">
              <div className="stack-sm">
                <h3>
                  <SignalIcon className="inline-icon" /> {t("catalog.checkDevice")}
                </h3>
                <p className="muted small">{t("catalog.checkDeviceBody")}</p>
                <Link
                  className="button button-ghost button-small"
                  href={href("/compatibility")}
                >
                  {t("catalog.checkCompatibility")} <ArrowRight className="inline-icon" />
                </Link>
              </div>
              <div className="stack-sm">
                <h3>
                  <QrIcon className="inline-icon" /> {t("catalog.readGuide")}
                </h3>
                <p className="muted small">{t("catalog.readGuideBody")}</p>
                <Link className="button button-ghost button-small" href={href("/guides")}>
                  {t("catalog.openGuides")} <ArrowRight className="inline-icon" />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <aside className="checkout-sidebar" aria-label={t("catalog.purchasePlan")}>
          <section className="card summary-card">
            {demo ? (
              <p>
                <span className="badge badge-demo">{t("demo.badge")}</span>
              </p>
            ) : null}
            <div className="price-block" style={{ marginTop: "0.7rem" }}>
              <span className="price" dir="ltr">
                {formatMoney(plan.priceMinor, plan.currency)}
              </span>
            </div>
            <div className="summary-row">
              <span>{t("catalog.data")}</span>
              <span dir="ltr">{formatData(plan.dataMb)}</span>
            </div>
            <div className="summary-row">
              <span>{t("catalog.validity")}</span>
              <span dir="ltr">
                {plan.validityDays} {t("common.days")}
              </span>
            </div>
            <div className="summary-row">
              <span>{t("catalog.activation")}</span>
              <span>
                {demo ? t("demo.activationValue") : t("catalog.activationValue")}
              </span>
            </div>
            <div className="summary-row">
              <span>{t("catalog.payment")}</span>
              <span>{demo ? t("demo.paymentValue") : t("catalog.paymentValue")}</span>
            </div>
            <div className="summary-total">
              <span>{t("common.total")}</span>
              <span dir="ltr">{formatMoney(plan.priceMinor, plan.currency)}</span>
            </div>
            {demo ? (
              <div className="stack-sm" style={{ marginTop: "1rem" }}>
                <Link className="button button-wide" href={href("/checkout?demo=1")}>
                  <ArrowRight className="inline-icon" /> {t("demo.previewCheckout")}
                </Link>
                <p className="form-note">{t("demo.previewExplain")}</p>
              </div>
            ) : (
              <div className="stack-sm" style={{ marginTop: "1rem" }}>
                <form action={addToCartAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="quantity" value="1" />
                  <input type="hidden" name="checkout" value="1" />
                  <button className="button button-wide" type="submit">
                    <CartIcon className="inline-icon" /> {t("catalog.buyPlan")}
                  </button>
                </form>
                <form action={addToCartAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="quantity" value="1" />
                  <button className="button button-secondary button-wide" type="submit">
                    {t("catalog.addToCart")}
                  </button>
                </form>
              </div>
            )}
            <p className="form-note">
              <ClockIcon className="inline-icon" />{" "}
              {demo ? t("demo.priceNote") : t("catalog.chargeNote")}
            </p>
          </section>
          <section className="card summary-card">
            <h2>
              <GlobeIcon className="inline-icon" /> {t("catalog.needDestination")}
            </h2>
            <p className="muted small">{t("catalog.needDestinationBody")}</p>
            <Link className="button button-ghost button-small" href={href("/plans")}>
              {t("catalog.allPlans")} <ArrowRight className="inline-icon" />
            </Link>
          </section>
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="section" aria-labelledby="related-plans">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("catalog.sameDestination")}</p>
              <h2 id="related-plans">{t("catalog.compareOther")}</h2>
            </div>
          </div>
          <div className="grid grid-3">
            {related.map((item) => (
              <article key={item.id} className={`card plan-card accent-${item.accent}`}>
                <div className="plan-card-top">
                  <div>
                    <p className="eyebrow">{item.name}</p>
                    <h3>
                      <Link href={href(`/plans/${item.slug}`)}>
                        {t("catalog.planDays", {
                          data: formatData(item.dataMb),
                          count: item.validityDays,
                        })}
                      </Link>
                    </h3>
                  </div>
                </div>
                <div className="plan-card-bottom">
                  <span className="price" dir="ltr">
                    {formatMoney(item.priceMinor, item.currency)}
                  </span>
                  <Link className="button button-ghost button-small" href={href(`/plans/${item.slug}`)}>
                    {t("common.details")}
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
