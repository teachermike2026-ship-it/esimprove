import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import {
  getDestinationBySlug,
  getDestinations,
  getMultiCountryPlansCovering,
  getPlansForDestination,
} from "@/lib/catalog";
import { destinationFacts, type PlanPick } from "@/lib/destination-facts";
import { PlanCard } from "@/components/plan-card";
import { DestinationCard } from "@/components/destination-card";
import { DestinationFlag } from "@/components/country-flag";
import { EditorialGuideCard } from "@/components/blog/editorial-guide-card";
import { editorialForDestination } from "@/lib/editorial";
import { formatData, formatMoney } from "@/lib/money";
import { siteUrl } from "@/lib/config";
import { absoluteLocalizedUrl } from "@/lib/i18n/config";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getI18n();
  const db = await getDb();
  const row = await getDestinationBySlug(db, slug);
  if (!row) notFound();
  const facts = destinationFacts(await getPlansForDestination(db, row.destination.id));
  const country = row.destination.name;
  return localizedMetadata({
    path: `/destinations/${row.destination.slug}`,
    title: facts
      ? t("dest.seoTitle", { country, price: formatMoney(facts.fromPriceMinor, facts.currency) })
      : t("catalog.destinationTitle", { country }),
    description: facts
      ? t("dest.metaDescription", {
          country,
          count: facts.planCount,
          price: formatMoney(facts.fromPriceMinor, facts.currency),
          minData: formatData(facts.minDataMb),
          maxData: formatData(facts.maxDataMb),
          minDays: facts.minValidityDays,
          maxDays: facts.maxValidityDays,
        })
      : row.destination.summary || t("catalog.destinationSummary", { country }),
  });
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { t, href, locale } = await getI18n();
  const db = await getDb();
  const row = await getDestinationBySlug(db, slug);
  if (!row) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const plans = await getPlansForDestination(db, row.destination.id);
  const regionDestinations = await getDestinations(db, { regionSlug: row.region.slug });
  const otherDestinations = regionDestinations.filter((item) => item.id !== row.destination.id);
  const fromPrice = plans.length > 0 ? Math.min(...plans.map((plan) => plan.priceMinor)) : null;
  const facts = destinationFacts(plans);
  const covering = await getMultiCountryPlansCovering(db, row.destination.countryCode, row.destination.id);
  const country = row.destination.name;
  const guide = editorialForDestination(row.destination.slug);
  const money = (minor: number) => formatMoney(minor, facts?.currency ?? "USD");
  const dayCount = (count: number) => (count === 1 ? t("dest.oneDay") : t("dest.daysSingle", { days: count }));
  const days = (min: number, max: number) => (min === max ? dayCount(min) : t("dest.daysRange", { min, max }));
  const planLabel = (plan: PlanPick) => `${formatData(plan.dataMb)} · ${dayCount(plan.validityDays)}`;

  // Answers are generated only from catalog facts shown on this page.
  const faq: Array<{ q: string; a: string; device?: boolean }> = [];
  if (facts) {
    faq.push({
      q: t("dest.faqPriceQ", { country }),
      a: t("dest.faqPriceA", {
        country,
        count: facts.planCount,
        price: money(facts.fromPriceMinor),
        cheapest: planLabel(facts.cheapest),
      }),
    });
    faq.push({
      q: t("dest.faqNetworkQ", { country }),
      a: `${
        facts.networks.length
          ? t("dest.faqNetworkA", { country, networks: facts.networks.join(", ") })
          : t("dest.faqNetworkANone", { country })
      } ${facts.has5G ? t("dest.faq5GYes") : t("dest.faq5GNo")}`,
    });
    faq.push({
      q: t("dest.faqPhoneQ", { country }),
      a: facts.allDataOnly ? t("dest.faqPhoneAAll") : t("dest.faqPhoneASome"),
    });
    const validity =
      facts.validityStartsOnConnection === facts.planCount
        ? t("dest.faqValidityAConnect", { country })
        : facts.validityStartsOnInstall === facts.planCount
          ? t("dest.faqValidityAInstall")
          : t("dest.faqValidityAMixed");
    faq.push({
      q: t("dest.faqValidityQ", { country }),
      a: facts.activationWindowDays
        ? `${validity} ${t("dest.faqActivationWindow", { days: facts.activationWindowDays })}`
        : validity,
    });
    faq.push({ q: t("dest.faqDeliveryQ", { country }), a: t("dest.faqDeliveryA") });
    faq.push({ q: t("dest.faqDeviceQ", { country }), a: t("dest.faqDeviceA"), device: true });
  }
  const pickCandidates: Array<[string, PlanPick | null, string | null]> = facts
    ? [
        [t("dest.pickCheapest"), facts.cheapest, null],
        [
          t("dest.pickValue"),
          facts.bestValuePerGb,
          facts.bestValuePerGb ? t("dest.perGb", { price: money(facts.bestValuePerGb.centsPerGb) }) : null,
        ],
        [t("dest.pickWeek"), facts.forAWeek, null],
        [t("dest.pickMonth"), facts.forAMonth, null],
        [t("dest.pickMostData"), facts.mostData, null],
      ]
    : [];
  const seenPicks = new Set<string>();
  const picks: Array<[string, PlanPick, string | null]> = [];
  for (const [label, plan, extra] of pickCandidates) {
    if (!plan || seenPicks.has(plan.slug)) continue;
    seenPicks.add(plan.slug);
    picks.push([label, plan, extra]);
  }
  const pageUrl = absoluteLocalizedUrl(`/destinations/${row.destination.slug}`, locale, siteUrl);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("catalog.breadcrumbDestinations"),
        item: absoluteLocalizedUrl("/destinations", locale, siteUrl),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: row.region.name,
        item: absoluteLocalizedUrl(`/regions/${row.region.slug}`, locale, siteUrl),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: row.destination.name,
        item: absoluteLocalizedUrl(`/destinations/${row.destination.slug}`, locale, siteUrl),
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
      {facts ? (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Product",
                  "@id": `${pageUrl}#product`,
                  name: t("catalog.destinationTitle", { country }),
                  description: t("dest.metaDescription", {
                    country,
                    count: facts.planCount,
                    price: money(facts.fromPriceMinor),
                    minData: formatData(facts.minDataMb),
                    maxData: formatData(facts.maxDataMb),
                    minDays: facts.minValidityDays,
                    maxDays: facts.maxValidityDays,
                  }),
                  category: "Prepaid travel eSIM data plan",
                  brand: { "@type": "Brand", name: "ESIMPROVE" },
                  url: pageUrl,
                  offers: {
                    "@type": "AggregateOffer",
                    priceCurrency: facts.currency,
                    lowPrice: (facts.fromPriceMinor / 100).toFixed(2),
                    highPrice: (facts.toPriceMinor / 100).toFixed(2),
                    offerCount: facts.planCount,
                  },
                },
                {
                  "@type": "FAQPage",
                  "@id": `${pageUrl}#faq`,
                  mainEntity: faq.map((item) => ({
                    "@type": "Question",
                    name: item.q,
                    acceptedAnswer: { "@type": "Answer", text: item.a },
                  })),
                },
              ],
            }),
          }}
        />
      ) : null}
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/destinations")}>{t("catalog.breadcrumbDestinations")}</Link>
          </li>
          <li>
            <Link href={href(`/regions/${row.region.slug}`)}>{row.region.name}</Link>
          </li>
          <li aria-current="page">{row.destination.name}</li>
        </ol>
      </nav>

      <section className={`card destination-hero accent-${row.region.accent}`}>
        <div className="destination-hero-art" aria-hidden="true">
          <DestinationFlag
            countryCode={row.destination.countryCode}
            name={country}
            coverage={[...new Set(plans.flatMap((plan) => plan.coverage ?? []))]}
            max={6}
            size="lg"
            eager
          />
        </div>
        <div className="destination-hero-copy">
          <p className="eyebrow">{row.region.name}</p>
          <h1>{t("catalog.destinationTitle", { country: row.destination.name })}</h1>
          <p className="lead">{row.destination.description}</p>
          <div className="pill-row">
            <span className="badge badge-neutral">
              {t("catalog.plansBadge", { count: plans.length })}
            </span>
            {fromPrice !== null ? (
              <span className="badge badge-neutral" dir="ltr">
                {t("catalog.fromPrice", { price: formatMoney(fromPrice, "USD") })}
              </span>
            ) : null}
          </div>
          {guide ? (
            <EditorialGuideCard
              article={guide}
              href={href}
              eyebrow={t("blog.guideEyebrow")}
              linkLabel={t("blog.readGuide")}
            />
          ) : null}
        </div>
      </section>

      {facts ? (
        <section className="section dest-facts" aria-labelledby="destination-facts">
          <div className="card form">
            <h2 id="destination-facts">{t("dest.factsTitle", { country })}</h2>
            <dl className="meta-list">
              <div>
                <dt>{t("dest.factPrice")}</dt>
                <dd>
                  {t("dest.factPriceValue", {
                    from: money(facts.fromPriceMinor),
                    to: money(facts.toPriceMinor),
                    count: facts.planCount,
                  })}
                </dd>
              </div>
              <div>
                <dt>{t("dest.factData")}</dt>
                <dd>
                  <span dir="ltr">
                    {formatData(facts.minDataMb)} – {formatData(facts.maxDataMb)}
                  </span>
                  {facts.hasDailyPlans ? ` · ${t("dest.dailyNote")}` : ""}
                </dd>
              </div>
              <div>
                <dt>{t("dest.factValidity")}</dt>
                <dd>{days(facts.minValidityDays, facts.maxValidityDays)}</dd>
              </div>
              <div>
                <dt>{t("dest.factNetworks")}</dt>
                <dd>{facts.networks.length ? facts.networks.join(", ") : t("dest.networksOnPlan")}</dd>
              </div>
              <div>
                <dt>{t("dest.fact5G")}</dt>
                <dd>{facts.has5G ? t("dest.fiveGYes") : t("dest.fiveGNo")}</dd>
              </div>
              <div>
                <dt>{t("dest.factPhone")}</dt>
                <dd>{facts.allDataOnly ? t("dest.dataOnlyAll") : t("dest.dataOnlySome")}</dd>
              </div>
              <div>
                <dt>{t("dest.factDelivery")}</dt>
                <dd>{t("dest.deliveryValue")}</dd>
              </div>
            </dl>
          </div>
          {picks.length ? (
            <div className="card form">
              <h2>{t("dest.picksTitle", { country })}</h2>
              <ul className="dest-picks">
                {picks.map(([label, plan, extra]) => (
                  <li key={label}>
                    <span className="muted">{label}:</span>{" "}
                    <Link href={href(`/plans/${plan.slug}`)}>
                      {planLabel(plan)} — <span dir="ltr">{money(plan.priceMinor)}</span>
                    </Link>
                    {extra ? <span className="muted"> ({extra})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="section" aria-labelledby="destination-plans">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("catalog.compare")}</p>
            <h2 id="destination-plans">
              {t("catalog.plansFor", { country: row.destination.name })}
            </h2>
            <p className="muted">{t("catalog.compareBody")}</p>
          </div>
          <Link
            className="button button-ghost"
            href={href(`/plans?destination=${row.destination.slug}`)}
          >
            {t("catalog.filterAllPlans")}
          </Link>
        </div>
        <div className="grid grid-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>

      {covering.length ? (
        <section className="section" aria-labelledby="destination-regional">
          <div className="section-heading">
            <div>
              <h2 id="destination-regional">{t("dest.regionalTitle", { country })}</h2>
              <p className="muted">{t("dest.regionalBody")}</p>
            </div>
          </div>
          <ul className="pill-row">
            {covering.slice(0, 12).map((group) => (
              <li key={group.destinationSlug}>
                <Link className="badge badge-neutral" href={href(`/destinations/${group.destinationSlug}`)}>
                  {group.destinationName} ·{" "}
                  {t("dest.regionalLine", { count: group.planCount, price: money(group.fromPriceMinor) })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {faq.length ? (
        <section className="section" aria-labelledby="destination-faq">
          <h2 id="destination-faq">{t("dest.faqTitle", { country })}</h2>
          <div className="stack">
            {faq.map((item) => (
              <details key={item.q} className="card dest-faq">
                <summary>
                  <h3>{item.q}</h3>
                </summary>
                <p>
                  {item.a}
                  {item.device ? (
                    <>
                      {" "}
                      <Link href={href("/compatibility")}>{t("footer.deviceCompatibility")}</Link>
                    </>
                  ) : null}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section" aria-labelledby="region-more">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("catalog.keepExploring")}</p>
            <h2 id="region-more">{t("catalog.moreIn", { region: row.region.name })}</h2>
          </div>
        </div>
        <div className="grid grid-4">
          {otherDestinations.slice(0, 4).map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      </section>
    </>
  );
}
