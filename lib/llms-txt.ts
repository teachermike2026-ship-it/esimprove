/**
 * llms.txt (https://llmstxt.org): a plain-markdown summary that AI assistants
 * and answer engines can read to understand what ESIMPROVE sells, its prices
 * and policies, and which pages to cite. Generated from the live catalog so
 * every number matches the website.
 */
import type { Database } from "@/lib/db/client";
import { getDestinations, getPlans, type PlanSummary } from "@/lib/catalog";
import { destinationFacts } from "@/lib/destination-facts";
import { guides } from "@/lib/guides";
import { EDITORIAL_ARTICLES, EDITORIAL_CATEGORIES, plainInline } from "@/lib/editorial";
import { formatData, formatMoney } from "@/lib/money";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";

function money(minor: number, currency = "USD"): string {
  return formatMoney(minor, currency);
}

async function catalog(db: Database) {
  const [destinations, plans] = await Promise.all([getDestinations(db), getPlans(db, { limit: 20_000 })]);
  const byDestination = new Map<string, PlanSummary[]>();
  for (const plan of plans) {
    const list = byDestination.get(plan.destinationId) ?? [];
    list.push(plan);
    byDestination.set(plan.destinationId, list);
  }
  const rows = destinations
    .map((destination) => ({ destination, facts: destinationFacts(byDestination.get(destination.id) ?? []) }))
    .filter((row) => row.facts !== null) as Array<{
    destination: (typeof destinations)[number];
    facts: NonNullable<ReturnType<typeof destinationFacts>>;
  }>;
  return { rows, planCount: plans.length, fromPrice: plans.length ? Math.min(...plans.map((p) => p.priceMinor)) : null };
}

function header(base: string, planCount: number, destinationCount: number, fromPrice: number | null): string[] {
  return [
    "# ESIMPROVE",
    "",
    `> ESIMPROVE (${base}) is an online store for prepaid travel eSIM data plans: ${planCount} plans for ${destinationCount} countries and multi-country regions${
      fromPrice !== null ? `, from ${money(fromPrice)}` : ""
    }. Plans are delivered online as a QR code with manual installation details, usually within minutes of payment.`,
    "",
    "Key facts:",
    "- Prices are in US dollars. The total shown at checkout is the total paid; no fees are added later.",
    "- Plans are data only unless a plan page says otherwise: no phone number, calls or SMS, and no emergency calls.",
    "- The device must support eSIM and be carrier-unlocked. Device compatibility guide: " + `${base}/compatibility`,
    "- Payment: USDT (BEP-20) on BNB Smart Chain at 1 USDT = 1 USD; an order is paid after 15 block confirmations. Card payment is shown as coming soon until enabled.",
    "- Refunds: full refund before the eSIM is installed or activated; see the refund policy for faults and withdrawal rights.",
    "- Each plan page states the countries, data, validity, networks, when validity starts and the activation deadline.",
    `- Contact: ${LEGAL_CONTACT_EMAIL} (email only). Seller: an online brand run by an individual operator from Vietnam; not a registered company.`,
    "",
  ];
}

export async function buildLlmsTxt(db: Database, base: string): Promise<string> {
  const { rows, planCount, fromPrice } = await catalog(db);
  const top = [...rows]
    .sort((a, b) => Number(b.destination.popular) - Number(a.destination.popular) || b.facts.planCount - a.facts.planCount)
    .slice(0, 40);
  const lines = header(base, planCount, rows.length, fromPrice);
  lines.push("## Shop");
  lines.push(`- [All destinations](${base}/destinations): every country and region with prices.`);
  lines.push(`- [Regions](${base}/regions): multi-country plans by region.`);
  lines.push(`- [All plans](${base}/plans): filter by data, validity and price.`);
  lines.push("");
  lines.push("## Popular destinations");
  for (const { destination, facts } of top) {
    lines.push(
      `- [${destination.name} eSIM](${base}/destinations/${destination.slug}): ${facts.planCount} plans from ${money(facts.fromPriceMinor, facts.currency)}; ${formatData(facts.minDataMb)} to ${formatData(facts.maxDataMb)}; ${facts.minValidityDays}-${facts.maxValidityDays} days.`,
    );
  }
  lines.push("");
  lines.push("## Guides");
  for (const guide of guides) lines.push(`- [${guide.title}](${base}/guides/${guide.slug}): ${guide.summary}`);
  lines.push("");
  lines.push("## Blog");
  lines.push(`- [Travel eSIM guides & insights](${base}/blog): all articles, in English.`);
  for (const category of EDITORIAL_CATEGORIES) {
    if (!EDITORIAL_ARTICLES.some((article) => article.category === category.slug)) continue;
    lines.push(`- [${category.name}](${base}/blog/category/${category.slug}): ${category.description}`);
  }
  for (const article of EDITORIAL_ARTICLES) {
    lines.push(`- [${article.title}](${base}/blog/${article.slug}): ${article.description}`);
  }
  lines.push("");
  lines.push("## Policies");
  lines.push(`- [eSIM service and delivery terms](${base}/legal/esim-service): compatibility, coverage, activation, validity, failed delivery.`);
  lines.push(`- [Payment terms](${base}/legal/payments): USDT BEP-20 rules, wrong, late or partial payments.`);
  lines.push(`- [Refund and withdrawal policy](${base}/legal/refunds)`);
  lines.push(`- [Terms of service](${base}/legal/terms)`);
  lines.push(`- [Privacy policy](${base}/legal/privacy)`);
  lines.push(`- [Legal notice and complaints](${base}/legal/notice)`);
  lines.push("");
  lines.push("## Optional");
  lines.push(`- [Full destination price list](${base}/llms-full.txt): every destination with plan count, price range, data, validity and networks.`);
  lines.push("");
  return lines.join("\n");
}

export async function buildLlmsFullTxt(db: Database, base: string): Promise<string> {
  const { rows, planCount, fromPrice } = await catalog(db);
  const lines = header(base, planCount, rows.length, fromPrice);
  lines.push("## Travel guides (blog)");
  lines.push("");
  lines.push("Short answers from each ESIMPROVE guide. Prices are not repeated here; destination pages and the list below carry live prices.");
  lines.push("");
  for (const article of EDITORIAL_ARTICLES) {
    lines.push(`### [${article.title}](${base}/blog/${article.slug})`);
    lines.push(plainInline(article.quickAnswer));
    for (const item of article.faq) lines.push(`- Q: ${item.q} A: ${plainInline(item.a)}`);
    lines.push("");
  }
  lines.push(`## All destinations (${rows.length})`);
  lines.push("");
  lines.push("Prices in USD, generated from the live catalog. Follow the link for every plan and its details.");
  lines.push("");
  for (const { destination, facts } of [...rows].sort((a, b) => a.destination.name.localeCompare(b.destination.name))) {
    const parts = [
      `${facts.planCount} plans`,
      `${money(facts.fromPriceMinor, facts.currency)} to ${money(facts.toPriceMinor, facts.currency)}`,
      `data ${formatData(facts.minDataMb)} to ${formatData(facts.maxDataMb)}${facts.hasDailyPlans ? " (includes daily plans)" : ""}`,
      `validity ${facts.minValidityDays}-${facts.maxValidityDays} days`,
      facts.networks.length ? `networks: ${facts.networks.slice(0, 6).join(", ")}` : null,
      facts.has5G ? "5G on some plans" : null,
      facts.bestValuePerGb ? `best value ${money(facts.bestValuePerGb.centsPerGb, facts.currency)}/GB` : null,
    ].filter(Boolean);
    lines.push(`### [${destination.name}](${base}/destinations/${destination.slug})`);
    lines.push(`Region: ${destination.regionName}. ${parts.join("; ")}.`);
    lines.push("");
  }
  return lines.join("\n");
}
