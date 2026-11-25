import type { PlanSummary } from "@/lib/catalog";
import { demoMode, isLocal } from "@/lib/config";

/**
 * A single, clearly labelled demonstration product that exists only in code.
 *
 * It is deliberately not stored in the database so enabling it cannot modify
 * production catalogue records. It is visible only in local development/test
 * contexts and is never a purchasable plan.
 */
export const DEMO_PLAN_SLUG = "demo-esim-europe";
export const DEMO_PLAN_ID = "demo-plan-europe-1gb-7d";
export const DEMO_PLAN_SUPPLIER_KEY = "demo-local";

export const demoPlan: PlanSummary = {
  id: DEMO_PLAN_ID,
  slug: DEMO_PLAN_SLUG,
  name: "Demo eSIM — Europe",
  destinationId: "demo-destination-europe",
  destinationName: "Europe",
  destinationSlug: "europe",
  countryCode: "EU",
  regionName: "Europe",
  regionSlug: "europe",
  accent: "teal",
  supplierKey: DEMO_PLAN_SUPPLIER_KEY,
  supplierProductId: "demo-local-europe-1gb-7d",
  dataMb: 1000,
  validityDays: 7,
  costMinor: 0,
  markupBps: 0,
  priceMinor: 100,
  currency: "USD",
  taxBps: 0,
  coverageSummary: "Demo preview — no real network coverage",
  networkSummary: "No network or supplier is connected to this demo product.",
  description:
    "Local-only demonstration eSIM for previewing the catalogue and checkout interface. It is not for sale.",
  features: [],
  status: "demo",
  isDemo: true,
};

/**
 * The demo product must never appear in deployed contexts, even if the source
 * is deployed accidentally. DEMO_MODE=false also hides it locally.
 */
export function demoProductEnabled(): boolean {
  return isLocal && demoMode;
}

export function isDemoProductSlug(slug: string): boolean {
  return slug === DEMO_PLAN_SLUG;
}

export function isLocalDemoPlan(
  plan: Pick<PlanSummary, "slug" | "supplierKey">,
): boolean {
  return plan.slug === DEMO_PLAN_SLUG && plan.supplierKey === DEMO_PLAN_SUPPLIER_KEY;
}

export interface DemoPlanFilterInput {
  q?: string;
  destination?: string;
  region?: string;
  maxPrice?: number;
  minDataMb?: number;
  minValidityDays?: number;
}

/**
 * Reuses the public catalogue filters for the code-level demo product. The
 * demo has no destination page, so a destination filter hides it.
 */
export function demoPlanMatchesFilters(filters: DemoPlanFilterInput): boolean {
  if (filters.destination) return false;
  if (filters.region && filters.region !== demoPlan.regionSlug) return false;

  const query = filters.q?.trim().toLowerCase();
  if (query) {
    const haystack = [
      demoPlan.name,
      demoPlan.description,
      demoPlan.destinationName,
      demoPlan.regionName,
      "1 GB 7 days",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (
    filters.maxPrice !== undefined &&
    demoPlan.priceMinor > Math.round(filters.maxPrice * 100)
  ) {
    return false;
  }
  if (filters.minDataMb !== undefined && demoPlan.dataMb < filters.minDataMb) return false;
  if (
    filters.minValidityDays !== undefined &&
    demoPlan.validityDays < filters.minValidityDays
  ) {
    return false;
  }
  return true;
}
