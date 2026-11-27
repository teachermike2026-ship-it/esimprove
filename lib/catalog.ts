import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { destinations, plans, regions } from "@/lib/db/schema";
import { isCountryCode, normalizeCoverage } from "@/lib/flags";

export interface RegionSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  sortOrder: number;
  destinationCount: number;
  planCount: number;
  fromPriceMinor: number | null;
}

export interface DestinationSummary {
  id: string;
  slug: string;
  countryCode: string;
  name: string;
  summary: string;
  description: string;
  popular: boolean;
  regionId: string;
  regionName: string;
  regionSlug: string;
  accent: string;
  planCount: number;
  fromPriceMinor: number | null;
  /** ISO codes covered by a multi-country destination's plans (empty for single countries). */
  coverage?: string[];
}

export interface PlanSummary {
  id: string;
  slug: string;
  name: string;
  destinationId: string;
  destinationName: string;
  destinationSlug: string;
  countryCode: string;
  regionName: string;
  regionSlug: string;
  accent: string;
  supplierKey: string;
  supplierProductId: string;
  dataMb: number;
  validityDays: number;
  costMinor: number;
  markupBps: number;
  priceMinor: number;
  currency: string;
  taxBps: number;
  coverageSummary: string;
  networkSummary: string;
  description: string;
  features: string[];
  status: string;
  isDemo: boolean;
  /** ISO codes the supplier lists for this package (empty for single-country plans). */
  coverage?: string[];
}

export interface PlanFilters {
  q?: string;
  destination?: string;
  region?: string;
  maxPrice?: number;
  minDataMb?: number;
  minValidityDays?: number;
  sort?: "price_asc" | "price_desc" | "data_desc" | "newest";
  limit?: number;
}

function toPlanSummary(row: {
  plan: typeof plans.$inferSelect;
  destination: typeof destinations.$inferSelect;
  region: typeof regions.$inferSelect;
}): PlanSummary {
  return {
    id: row.plan.id,
    slug: row.plan.slug,
    name: row.plan.name,
    destinationId: row.plan.destinationId,
    destinationName: row.destination.name,
    destinationSlug: row.destination.slug,
    countryCode: row.destination.countryCode,
    regionName: row.region.name,
    regionSlug: row.region.slug,
    accent: row.region.accent,
    supplierKey: row.plan.supplierKey,
    supplierProductId: row.plan.supplierProductId,
    dataMb: row.plan.dataMb,
    validityDays: row.plan.validityDays,
    costMinor: row.plan.costMinor,
    markupBps: row.plan.markupBps,
    priceMinor: row.plan.priceMinor,
    currency: row.plan.currency,
    taxBps: row.plan.taxBps,
    coverageSummary: row.plan.coverageSummary,
    networkSummary: row.plan.networkSummary,
    description: row.plan.description,
    features: row.plan.features,
    status: row.plan.status,
    isDemo: row.plan.isDemo,
    coverage: normalizeCoverage(row.plan.supplierMetadata?.countries),
  };
}

async function planRows(db: Database, conditions: SQL[] = [], filters: PlanFilters = {}) {
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  let query = db
    .select({
      plan: plans,
      destination: destinations,
      region: regions,
    })
    .from(plans)
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .$dynamic();

  if (where) query = query.where(where);

  switch (filters.sort) {
    case "price_desc":
      query = query.orderBy(desc(plans.priceMinor));
      break;
    case "data_desc":
      query = query.orderBy(desc(plans.dataMb), asc(plans.priceMinor));
      break;
    case "newest":
      query = query.orderBy(desc(plans.createdAt));
      break;
    default:
      query = query.orderBy(asc(plans.priceMinor));
  }

  const rows = await query.limit(filters.limit ?? 60);
  return rows.map(toPlanSummary);
}

export async function getRegions(db: Database): Promise<RegionSummary[]> {
  const regionRows = await db.select().from(regions).orderBy(asc(regions.sortOrder));
  const destinationRows = await db.select().from(destinations);
  const stats = await publishedPlanStats(db);

  return regionRows.map((region) => {
    // Only destinations with at least one published plan count as visible.
    const visible = destinationRows.filter(
      (item) => item.regionId === region.id && stats.has(item.id),
    );
    let planCount = 0;
    let fromPriceMinor: number | null = null;
    for (const destination of visible) {
      const stat = stats.get(destination.id)!;
      planCount += stat.count;
      fromPriceMinor = fromPriceMinor === null ? stat.min : Math.min(fromPriceMinor, stat.min);
    }
    return {
      ...region,
      destinationCount: visible.length,
      planCount,
      fromPriceMinor,
    };
  });
}

/** Published plan count and lowest price per destination, in one pass. */
async function publishedPlanStats(db: Database): Promise<Map<string, { count: number; min: number }>> {
  const planRows = await db
    .select({ destinationId: plans.destinationId, priceMinor: plans.priceMinor })
    .from(plans)
    .where(eq(plans.status, "published"));
  const stats = new Map<string, { count: number; min: number }>();
  for (const plan of planRows) {
    const stat = stats.get(plan.destinationId);
    if (stat) {
      stat.count += 1;
      if (plan.priceMinor < stat.min) stat.min = plan.priceMinor;
    } else {
      stats.set(plan.destinationId, { count: 1, min: plan.priceMinor });
    }
  }
  return stats;
}

/**
 * Countries covered by each multi-country destination: the union, in supplier
 * order, of `supplier_metadata.countries` across its published plans.
 */
export async function getCoverageByDestination(db: Database): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ destinationId: plans.destinationId, countryCode: destinations.countryCode, metadata: plans.supplierMetadata })
    .from(plans)
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .where(eq(plans.status, "published"));
  const coverage = new Map<string, Set<string>>();
  for (const row of rows) {
    if (isCountryCode(row.countryCode)) continue;
    const set = coverage.get(row.destinationId) ?? new Set<string>();
    for (const code of normalizeCoverage(row.metadata?.countries)) set.add(code);
    coverage.set(row.destinationId, set);
  }
  return new Map([...coverage].map(([id, set]) => [id, [...set]]));
}

export async function getDestinations(
  db: Database,
  options: { popular?: boolean; regionSlug?: string } = {},
): Promise<DestinationSummary[]> {
  const destinationRows = await db
    .select({ destination: destinations, region: regions })
    .from(destinations)
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .orderBy(asc(regions.sortOrder), asc(destinations.name));
  const [stats, coverage] = await Promise.all([publishedPlanStats(db), getCoverageByDestination(db)]);

  return destinationRows
    .filter((row) => !options.popular || row.destination.popular)
    .filter((row) => !options.regionSlug || row.region.slug === options.regionSlug)
    // Destinations without a published plan (for example demo-only entries
    // hidden after a real catalog import) are not shown to customers.
    .filter((row) => stats.has(row.destination.id))
    .map((row) => {
      const stat = stats.get(row.destination.id)!;
      return {
        ...row.destination,
        regionName: row.region.name,
        regionSlug: row.region.slug,
        accent: row.region.accent,
        planCount: stat.count,
        fromPriceMinor: stat.min,
        coverage: coverage.get(row.destination.id) ?? [],
      };
    });
}

export async function getDestinationBySlug(db: Database, slug: string) {
  const rows = await db
    .select({ destination: destinations, region: regions })
    .from(destinations)
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .where(eq(destinations.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRegionBySlug(db: Database, slug: string) {
  const rows = await db.select().from(regions).where(eq(regions.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getPlans(db: Database, filters: PlanFilters = {}): Promise<PlanSummary[]> {
  const conditions: SQL[] = [eq(plans.status, "published")];
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(plans.name, q),
        ilike(plans.description, q),
        ilike(destinations.name, q),
        ilike(regions.name, q),
      )!,
    );
  }
  if (filters.destination) conditions.push(eq(destinations.slug, filters.destination));
  if (filters.region) conditions.push(eq(regions.slug, filters.region));
  if (filters.maxPrice && Number.isFinite(filters.maxPrice)) {
    conditions.push(lte(plans.priceMinor, Math.round(filters.maxPrice * 100)));
  }
  if (filters.minDataMb) conditions.push(gte(plans.dataMb, filters.minDataMb));
  if (filters.minValidityDays) conditions.push(gte(plans.validityDays, filters.minValidityDays));
  return planRows(db, conditions, filters);
}

export async function getFeaturedPlans(db: Database, limit = 6): Promise<PlanSummary[]> {
  const rows = await db
    .select({ plan: plans, destination: destinations, region: regions })
    .from(plans)
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .where(and(eq(plans.status, "published"), eq(destinations.popular, true)))
    .orderBy(asc(plans.priceMinor))
    .limit(limit);
  return rows.map(toPlanSummary);
}

export async function getPlanBySlug(db: Database, slug: string): Promise<PlanSummary | null> {
  const rows = await db
    .select({ plan: plans, destination: destinations, region: regions })
    .from(plans)
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .where(eq(plans.slug, slug))
    .limit(1);
  const row = rows[0];
  return row ? toPlanSummary(row) : null;
}

export async function getPlansForDestination(
  db: Database,
  destinationId: string,
): Promise<PlanSummary[]> {
  const rows = await db
    .select({ plan: plans, destination: destinations, region: regions })
    .from(plans)
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .where(and(eq(plans.destinationId, destinationId), eq(plans.status, "published")))
    .orderBy(asc(plans.priceMinor));
  return rows.map(toPlanSummary);
}

export async function getPlanPriceRange(db: Database): Promise<{ min: number; max: number }> {
  const rows = await db
    .select({ priceMinor: plans.priceMinor })
    .from(plans)
    .where(eq(plans.status, "published"));
  if (rows.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...rows.map((row) => row.priceMinor)),
    max: Math.max(...rows.map((row) => row.priceMinor)),
  };
}

export interface CoveringPlanGroup {
  destinationSlug: string;
  destinationName: string;
  planCount: number;
  fromPriceMinor: number;
}

/**
 * Multi-country plans (sold under another destination, e.g. "Europe") whose
 * coverage list includes this country. Coverage comes from the supplier's
 * country list stored with each plan.
 */
export async function getMultiCountryPlansCovering(
  db: Database,
  countryCode: string,
  excludeDestinationId: string,
): Promise<CoveringPlanGroup[]> {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return [];
  const rows = await db
    .select({
      destinationSlug: destinations.slug,
      destinationName: destinations.name,
      planCount: sql<number>`count(*)::int`,
      fromPriceMinor: sql<number>`min(${plans.priceMinor})::bigint`,
    })
    .from(plans)
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .where(
      and(
        eq(plans.status, "published"),
        sql`${plans.destinationId} <> ${excludeDestinationId}`,
        sql`(${plans.supplierMetadata} -> 'countries') @> ${JSON.stringify([code])}::jsonb`,
      ),
    )
    .groupBy(destinations.slug, destinations.name)
    .orderBy(sql`min(${plans.priceMinor})`);
  return rows.map((row) => ({ ...row, planCount: Number(row.planCount), fromPriceMinor: Number(row.fromPriceMinor) }));
}
