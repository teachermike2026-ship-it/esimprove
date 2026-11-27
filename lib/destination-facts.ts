/**
 * Facts about a destination's eSIM plans, computed only from the published
 * catalog. Used for destination page summaries, FAQ answers, structured data
 * and llms.txt, so every statement an answer engine reads is verifiable on
 * the page and in the plan list. Nothing here is estimated or invented.
 */
import type { PlanSummary } from "@/lib/catalog";
import { isUnlimitedData } from "@/lib/money";

export interface PlanPick {
  slug: string;
  name: string;
  priceMinor: number;
  dataMb: number;
  validityDays: number;
}

export interface DestinationFacts {
  planCount: number;
  currency: string;
  fromPriceMinor: number;
  toPriceMinor: number;
  cheapest: PlanPick;
  /** Lowest price per GB among total-data plans of at least 1 GB. */
  bestValuePerGb: (PlanPick & { centsPerGb: number }) | null;
  mostData: PlanPick | null;
  /** Cheapest plan valid for at least 7 / 15 / 30 days. */
  forAWeek: PlanPick | null;
  forTwoWeeks: PlanPick | null;
  forAMonth: PlanPick | null;
  minValidityDays: number;
  maxValidityDays: number;
  minDataMb: number;
  maxDataMb: number;
  hasDailyPlans: boolean;
  hasUnlimited: boolean;
  networks: string[];
  has5G: boolean;
  allDataOnly: boolean;
  validityStartsOnInstall: number;
  validityStartsOnConnection: number;
  activationWindowDays: number | null;
}

function pick(plan: PlanSummary): PlanPick {
  return {
    slug: plan.slug,
    name: plan.name,
    priceMinor: plan.priceMinor,
    dataMb: plan.dataMb,
    validityDays: plan.validityDays,
  };
}

function isDaily(plan: PlanSummary): boolean {
  return plan.features.some((feature) => /per day|daily/i.test(feature));
}

function cheapestWith(plans: PlanSummary[], test: (plan: PlanSummary) => boolean): PlanPick | null {
  let best: PlanSummary | null = null;
  for (const plan of plans) {
    if (!test(plan)) continue;
    if (!best || plan.priceMinor < best.priceMinor || (plan.priceMinor === best.priceMinor && plan.dataMb > best.dataMb)) {
      best = plan;
    }
  }
  return best ? pick(best) : null;
}

/** Operator names from "Orange (5G), Movistar (4G)"-style summaries. */
function operators(plans: PlanSummary[]): { names: string[]; has5G: boolean } {
  const names = new Set<string>();
  let has5G = false;
  for (const plan of plans) {
    for (const part of plan.networkSummary.split(/[,;]/)) {
      const value = part.trim();
      if (!value) continue;
      if (/5G/i.test(value)) has5G = true;
      const name = value.replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (name && name.length <= 60) names.add(name);
    }
    if (plan.features.some((feature) => /5G/.test(feature))) has5G = true;
  }
  return { names: [...names].sort((a, b) => a.localeCompare(b)).slice(0, 12), has5G };
}

export function destinationFacts(plans: PlanSummary[]): DestinationFacts | null {
  const published = plans.filter((plan) => plan.status === "published");
  if (published.length === 0) return null;
  const sorted = [...published].sort((a, b) => a.priceMinor - b.priceMinor);
  // Per-GB comparisons only make sense for plans with a real data cap.
  const totals = published.filter((plan) => !isDaily(plan) && plan.dataMb >= 1024 && !isUnlimitedData(plan.dataMb));

  let bestValue: (PlanPick & { centsPerGb: number }) | null = null;
  for (const plan of totals) {
    const centsPerGb = Math.round((plan.priceMinor * 1024) / plan.dataMb);
    if (!bestValue || centsPerGb < bestValue.centsPerGb) bestValue = { ...pick(plan), centsPerGb };
  }

  const mostDataPlan = totals.reduce<PlanSummary | null>(
    (best, plan) => (!best || plan.dataMb > best.dataMb || (plan.dataMb === best.dataMb && plan.priceMinor < best.priceMinor) ? plan : best),
    null,
  );
  const { names, has5G } = operators(published);
  const activationWindows = published
    .map((plan) => /Activate within (\d+) days/i.exec(plan.features.join(" "))?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);

  return {
    planCount: published.length,
    currency: sorted[0]!.currency,
    fromPriceMinor: sorted[0]!.priceMinor,
    toPriceMinor: sorted[sorted.length - 1]!.priceMinor,
    cheapest: pick(sorted[0]!),
    bestValuePerGb: bestValue,
    mostData: mostDataPlan ? pick(mostDataPlan) : null,
    forAWeek: cheapestWith(published, (plan) => plan.validityDays >= 7),
    forTwoWeeks: cheapestWith(published, (plan) => plan.validityDays >= 15),
    forAMonth: cheapestWith(published, (plan) => plan.validityDays >= 30),
    minValidityDays: Math.min(...published.map((plan) => plan.validityDays)),
    maxValidityDays: Math.max(...published.map((plan) => plan.validityDays)),
    minDataMb: Math.min(...published.map((plan) => plan.dataMb)),
    maxDataMb: Math.max(...published.map((plan) => plan.dataMb)),
    hasDailyPlans: published.some(isDaily),
    hasUnlimited: published.some(
      (plan) => isUnlimitedData(plan.dataMb) || plan.features.some((feature) => /unlimited/i.test(feature)),
    ),
    networks: names,
    has5G,
    allDataOnly: published.every((plan) => plan.features.some((feature) => /data only/i.test(feature))),
    validityStartsOnInstall: published.filter((plan) => plan.features.some((f) => /starts when the eSIM is installed/i.test(f))).length,
    validityStartsOnConnection: published.filter((plan) => plan.features.some((f) => /starts on first connection/i.test(f))).length,
    activationWindowDays: activationWindows.length ? Math.min(...activationWindows) : null,
  };
}
