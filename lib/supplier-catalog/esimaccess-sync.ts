import { and, eq, getTableColumns, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { Database, DatabaseExecutor } from "@/lib/db/client";
import { destinations, plans, regions } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { recordProviderSyncJob } from "@/lib/operations";
import {
  effectiveMarkupBps,
  pricingPolicy,
  sellingPriceFromCost,
  type PricingPolicy,
} from "@/lib/pricing-config";
import {
  ESIM_ACCESS_PROVIDER_KEY,
  esimAccessCredentials,
  fetchEsimAccessPackages,
  type EsimAccessPackage,
} from "@/lib/integrations/supplier/esimaccess";
import { regionSlugForCountry, regionSlugForMultiCode } from "@/lib/supplier-catalog/esimaccess-regions";

/**
 * eSIM Access catalog synchronization.
 *
 * Safety:
 * - The supplier list is fetched and validated BEFORE any database write. A
 *   failed request, an empty list, or a list where most packages are invalid
 *   aborts with no change to the existing catalog.
 * - All writes run in one transaction.
 * - Plans are matched by the supplier package code (stable identifier); a
 *   plan's ESIMPROVE slug/URL never changes after it is created.
 * - Selling price guarantees the target net profit per eSIM after supplier
 *   cost and the configured card fee (lib/pricing-config.ts). It is always
 *   recomputed from the supplier cost, so re-syncing never compounds it.
 * - Packages that disappear, or whose cost cannot be verified, are archived
 *   (not deleted) so historical orders and eSIM records stay intact.
 * - After a successful real import, non-supplier (demo/sample) plans are
 *   archived so the public storefront shows supplier-backed packages only.
 */

export interface ExcludedPackage {
  packageCode: string;
  reason: string;
}

export interface EsimAccessSyncResult {
  status: "completed";
  retrieved: number;
  valid: number;
  excluded: ExcludedPackage[];
  created: number;
  updated: number;
  repriced: number;
  archivedMissing: number;
  archivedInvalid: number;
  demoPlansHidden: number;
  destinationsCreated: number;
  destinationTextsUpdated: number;
  regionTextsUpdated: number;
  countryPackages: number;
  regionalPackages: number;
  globalPackages: number;
  countries: number;
  multiCountryLocations: number;
  pricing: PricingPolicy;
}

export class CatalogSyncAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogSyncAbortedError";
  }
}

const BYTES_PER_MB = 1024 * 1024;
/** Wording used by the old demo seed; never shown next to real packages. */
const DEMO_WORDING = /\bdemo\b|illustrative|sample data|not real/i;

function kebab(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip the data/duration tail from a package name: "Europe 3GB 30Days" -> "Europe". */
function locationLabel(name: string): string {
  return name
    .replace(/\s*\d+(?:\.\d+)?\s*(?:GB|MB)(?:\s*\/\s*Day)?(?:\s+\d+\s*Days?)?\s*$/i, "")
    .replace(/\s+\d+\s*Days?\s*$/i, "")
    .trim();
}

function countriesOf(pkg: EsimAccessPackage): string[] {
  return pkg.location
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
}

function isMultiCountry(pkg: EsimAccessPackage): boolean {
  return countriesOf(pkg).length > 1;
}

function isGlobal(pkg: EsimAccessPackage): boolean {
  return /^GL-/i.test(pkg.locationCode ?? "");
}

/** Validate a package and return its supplier cost in USD cents, or a reason. */
export function validatePackage(pkg: EsimAccessPackage): { costMinor: number } | { reason: string } {
  if (typeof pkg.packageCode !== "string" || !pkg.packageCode.trim()) return { reason: "missing packageCode" };
  if (typeof pkg.slug !== "string" || !pkg.slug.trim()) return { reason: "missing slug" };
  if (typeof pkg.name !== "string" || !pkg.name.trim()) return { reason: "missing name" };
  if (pkg.currencyCode !== "USD") {
    // No verified exchange rate source is configured; never estimate a cost.
    return { reason: `unsupported currency ${String(pkg.currencyCode)}` };
  }
  if (!Number.isSafeInteger(pkg.price) || pkg.price <= 0) return { reason: "no valid supplier price" };
  if (pkg.price % 100 !== 0) return { reason: "supplier price is not a whole cent" };
  if (!Number.isSafeInteger(pkg.volume) || pkg.volume <= 0) return { reason: "no valid data volume" };
  if (pkg.durationUnit !== "DAY" || !Number.isSafeInteger(pkg.duration) || pkg.duration <= 0) {
    return { reason: "unsupported validity" };
  }
  if (countriesOf(pkg).length === 0) return { reason: "no coverage countries" };
  // Supplier price is in 1/10,000 USD; cents = price / 100.
  return { costMinor: pkg.price / 100 };
}

function formatData(volumeBytes: number): string {
  const gb = volumeBytes / (1024 * BYTES_PER_MB);
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  return `${Math.round(volumeBytes / BYTES_PER_MB)} MB`;
}

function countryNames(pkg: EsimAccessPackage): Map<string, string> {
  const names = new Map<string, string>();
  for (const network of pkg.locationNetworkList ?? []) {
    if (network.locationCode && network.locationName) {
      names.set(network.locationCode.toUpperCase(), network.locationName);
    }
  }
  return names;
}

function operatorsSummary(pkg: EsimAccessPackage): string {
  const operators = new Set<string>();
  for (const network of pkg.locationNetworkList ?? []) {
    for (const op of network.operatorList ?? []) {
      if (op.operatorName) {
        operators.add(op.networkType ? `${op.operatorName} (${op.networkType})` : op.operatorName);
      }
    }
  }
  const list = [...operators];
  if (list.length === 0) return pkg.speed ? `Partner networks · ${pkg.speed}` : "Partner networks";
  return list.length > 6 ? `${list.slice(0, 6).join(", ")} and ${list.length - 6} more` : list.join(", ");
}

function coverageSummary(pkg: EsimAccessPackage, names: Map<string, string>): string {
  const codes = countriesOf(pkg);
  const labels = codes.map((code) => names.get(code) ?? code);
  if (labels.length === 1) return labels[0]!;
  const shown = labels.slice(0, 12).join(", ");
  return `${labels.length} countries: ${shown}${labels.length > 12 ? ` and ${labels.length - 12} more` : ""}`;
}

function features(pkg: EsimAccessPackage): string[] {
  const out: string[] = [];
  const data = formatData(pkg.volume);
  const unlimited = pkg.volume >= 900 * 1024 * 1024 * 1024;
  if (unlimited && (pkg.dataType === 1 || pkg.dataType === undefined)) {
    // Supplier encodes unlimited packages as 999 GB; fair-use and speed
    // limits in the package name (e.g. "10Mbps") still apply.
    out.push("Unlimited data (fair use applies; see the plan name for any speed limit)");
  } else if (pkg.dataType === 1 || pkg.dataType === undefined) out.push(`${data} total data`);
  else if (pkg.dataType === 2) out.push(`${data} per day, then reduced speed${pkg.fupPolicy ? ` (${pkg.fupPolicy})` : ""}`);
  else if (pkg.dataType === 3) out.push(`${data} per day, then service pauses until the next day`);
  else if (pkg.dataType === 4) out.push("Unlimited daily data");
  if (pkg.speed) out.push(`Network: ${pkg.speed}`);
  if (pkg.activeType === 1) out.push("Validity starts when the eSIM is installed");
  else if (pkg.activeType === 2) out.push("Validity starts on first connection to a network");
  if (Number.isSafeInteger(pkg.unusedValidTime) && (pkg.unusedValidTime ?? 0) > 0) {
    out.push(`Activate within ${pkg.unusedValidTime} days of purchase`);
  }
  // Top-ups are not sold on ESIMPROVE, so the supplier's top-up capability
  // is not advertised (it would be a misleading claim).
  if (pkg.smsStatus === 0) out.push("Data only (no SMS or calls)");
  return out;
}

function supplierMetadata(pkg: EsimAccessPackage): Record<string, unknown> {
  return {
    provider: ESIM_ACCESS_PROVIDER_KEY,
    packageCode: pkg.packageCode,
    slug: pkg.slug,
    locationCode: pkg.locationCode ?? null,
    countries: countriesOf(pkg),
    volumeBytes: pkg.volume,
    duration: pkg.duration,
    durationUnit: pkg.durationUnit,
    dataType: pkg.dataType ?? null,
    speed: pkg.speed ?? null,
    ipExport: pkg.ipExport ?? null,
    fupPolicy: pkg.fupPolicy || null,
    supportTopUpType: pkg.supportTopUpType ?? null,
    activeType: pkg.activeType ?? null,
    unusedValidTime: pkg.unusedValidTime ?? null,
    smsStatus: pkg.smsStatus ?? null,
    supplierPriceRaw: pkg.price,
    retailPriceMinor: Number.isSafeInteger(pkg.retailPrice) ? Math.round((pkg.retailPrice ?? 0) / 100) : null,
    currencyCode: pkg.currencyCode,
  };
}

interface DestinationTarget {
  key: string;
  countryCode: string;
  name: string;
  regionSlug: string;
  slugBase: string;
  summary: string;
}

function destinationTarget(pkg: EsimAccessPackage, labelsByLocation: Map<string, string>): DestinationTarget {
  const codes = countriesOf(pkg);
  const names = countryNames(pkg);
  if (!isMultiCountry(pkg)) {
    const code = codes[0]!;
    const name = names.get(code) ?? code;
    return {
      key: `country:${code}`,
      countryCode: code,
      name,
      regionSlug: regionSlugForCountry(code),
      slugBase: kebab(name) || code.toLowerCase(),
      summary: `eSIM data plans for ${name}.`,
    };
  }
  const locationCode = (pkg.locationCode ?? codes.join("")).toUpperCase();
  const label = labelsByLocation.get(locationCode) ?? locationLabel(pkg.name);
  return {
    key: `multi:${locationCode}`,
    countryCode: locationCode,
    name: label,
    regionSlug: regionSlugForMultiCode(locationCode, codes),
    slugBase: `${kebab(label)}-${kebab(locationCode)}`,
    summary: `One eSIM for ${codes.length} countries.`,
  };
}

/** Most common cleaned label per multi-country location code. */
function multiLocationLabels(packages: EsimAccessPackage[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const pkg of packages) {
    if (!isMultiCountry(pkg) || !pkg.locationCode) continue;
    const code = pkg.locationCode.toUpperCase();
    const label = locationLabel(pkg.name);
    if (!label) continue;
    const bucket = counts.get(code) ?? new Map<string, number>();
    bucket.set(label, (bucket.get(label) ?? 0) + 1);
    counts.set(code, bucket);
  }
  const out = new Map<string, string>();
  for (const [code, bucket] of counts) {
    const best = [...bucket.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]!;
    out.set(code, best[0]);
  }
  return out;
}

export interface RunEsimAccessSyncOptions {
  /** Test seam; production fetches from eSIM Access with the configured credentials. */
  fetchPackages?: () => Promise<EsimAccessPackage[]>;
  now?: Date;
  pricing?: PricingPolicy;
  /** Archive published plans from other suppliers (demo/sample data). Default true. */
  hideNonSupplierPlans?: boolean;
  /** Abort if fewer than this share of packages are valid. Default 0.5. */
  minValidRatio?: number;
}

/** Rows per multi-row INSERT/UPDATE statement. */
const WRITE_BATCH = 200;

/** Supplier-derived plan columns that a sync refreshes (id, slug, createdAt are kept). */
const PLAN_REFRESH_KEYS = [
  "destinationId",
  "name",
  "dataMb",
  "validityDays",
  "costMinor",
  "markupBps",
  "priceMinor",
  "currency",
  "taxBps",
  "coverageSummary",
  "networkSummary",
  "description",
  "features",
  "status",
  "isDemo",
  "supplierMetadata",
  "supplierSyncedAt",
  "updatedAt",
] as const;
type PlanRefreshKey = (typeof PLAN_REFRESH_KEYS)[number];

/** JSON with sorted object keys (jsonb does not keep insertion order). */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** True when any supplier-derived plan field differs (timestamps ignored). */
export function planFieldsChanged(
  existing: Partial<Record<PlanRefreshKey, unknown>>,
  next: Partial<Record<PlanRefreshKey, unknown>>,
): boolean {
  for (const key of PLAN_REFRESH_KEYS) {
    if (key === "supplierSyncedAt" || key === "updatedAt") continue;
    const a = existing[key];
    const b = next[key];
    if (typeof b === "number") {
      if (Number(a) !== b) return true;
    } else if (stableJson(a) !== stableJson(b)) {
      return true;
    }
  }
  return false;
}

/** `SET col = excluded.col` for ON CONFLICT DO UPDATE. */
function excludedSet(keys: readonly PlanRefreshKey[]): Record<string, SQL> {
  const columns = getTableColumns(plans);
  return Object.fromEntries(keys.map((key) => [key, sql.raw(`excluded."${columns[key].name}"`)]));
}

export async function runEsimAccessCatalogSync(
  db: Database,
  options: RunEsimAccessSyncOptions = {},
): Promise<EsimAccessSyncResult> {
  const now = options.now ?? new Date();
  const pricing = options.pricing ?? pricingPolicy();

  let packages: EsimAccessPackage[];
  try {
    if (options.fetchPackages) {
      packages = await options.fetchPackages();
    } else {
      const credentials = esimAccessCredentials();
      if (!credentials) {
        throw new CatalogSyncAbortedError("ESIM_ACCESS_CODE and ESIM_SECRET_KEY are not configured");
      }
      packages = await fetchEsimAccessPackages({ credentials });
    }
  } catch (error) {
    await recordProviderSyncJob(db, {
      providerKey: ESIM_ACCESS_PROVIDER_KEY,
      status: "failed",
      details: { stage: "fetch", error: error instanceof Error ? error.message : String(error), at: now.toISOString() },
    });
    throw error;
  }

  // ---- Validate everything before touching the database -------------------
  const excluded: ExcludedPackage[] = [];
  const valid: Array<{ pkg: EsimAccessPackage; costMinor: number }> = [];
  const seenCodes = new Set<string>();
  for (const pkg of packages) {
    const code = typeof pkg?.packageCode === "string" ? pkg.packageCode : "(missing)";
    if (seenCodes.has(code)) {
      excluded.push({ packageCode: code, reason: "duplicate packageCode in supplier response" });
      continue;
    }
    seenCodes.add(code);
    const check = validatePackage(pkg);
    if ("reason" in check) excluded.push({ packageCode: code, reason: check.reason });
    else valid.push({ pkg, costMinor: check.costMinor });
  }
  if (packages.length === 0) {
    throw new CatalogSyncAbortedError("eSIM Access returned an empty catalog; nothing was changed");
  }
  if (valid.length / packages.length < (options.minValidRatio ?? 0.5)) {
    throw new CatalogSyncAbortedError(
      `Only ${valid.length} of ${packages.length} packages are valid; nothing was changed`,
    );
  }

  const labels = multiLocationLabels(valid.map((item) => item.pkg));
  const result: EsimAccessSyncResult = {
    status: "completed",
    retrieved: packages.length,
    valid: valid.length,
    excluded,
    created: 0,
    updated: 0,
    repriced: 0,
    archivedMissing: 0,
    archivedInvalid: 0,
    demoPlansHidden: 0,
    destinationsCreated: 0,
    destinationTextsUpdated: 0,
    regionTextsUpdated: 0,
    countryPackages: valid.filter((item) => !isMultiCountry(item.pkg)).length,
    regionalPackages: valid.filter((item) => isMultiCountry(item.pkg) && !isGlobal(item.pkg)).length,
    globalPackages: valid.filter((item) => isGlobal(item.pkg)).length,
    countries: new Set(valid.filter((item) => !isMultiCountry(item.pkg)).map((item) => countriesOf(item.pkg)[0])).size,
    multiCountryLocations: new Set(valid.filter((item) => isMultiCountry(item.pkg)).map((item) => item.pkg.locationCode)).size,
    pricing,
  };

  await db.transaction(async (tx) => {
    const regionRows = await tx.select().from(regions);
    for (const region of regionRows) {
      if (!DEMO_WORDING.test(region.description)) continue;
      const description =
        region.slug === "global"
          ? "Multi-country and global eSIM plans for trips across several regions."
          : `eSIM data plans for travel in ${region.name}.`;
      await tx.update(regions).set({ description }).where(eq(regions.id, region.id));
      result.regionTextsUpdated += 1;
    }
    const regionIdBySlug = new Map(regionRows.map((row) => [row.slug, row.id]));
    const fallbackRegionId = regionIdBySlug.get("global") ?? regionRows[0]?.id;
    if (!fallbackRegionId) throw new CatalogSyncAbortedError("No storefront regions exist");

    // Destinations: reuse by country code (keeps existing URLs), create otherwise.
    const destinationRows = await tx.select().from(destinations);
    const destinationByCode = new Map(destinationRows.map((row) => [row.countryCode.toUpperCase(), row]));
    const usedDestinationSlugs = new Set(destinationRows.map((row) => row.slug));
    const destinationIdByKey = new Map<string, string>();
    const newDestinations: Array<typeof destinations.$inferInsert> = [];
    for (const { pkg } of valid) {
      const target = destinationTarget(pkg, labels);
      if (destinationIdByKey.has(target.key)) continue;
      const existing = destinationByCode.get(target.countryCode);
      if (existing) {
        destinationIdByKey.set(target.key, existing.id);
        // Destinations created by the old demo seed describe themselves as
        // demo/illustrative. Once they carry real supplier plans, replace
        // that wording (slug, name and URL are kept).
        if (DEMO_WORDING.test(`${existing.summary ?? ""} ${existing.description ?? ""}`)) {
          await tx
            .update(destinations)
            .set({ summary: target.summary, description: target.summary })
            .where(eq(destinations.id, existing.id));
          result.destinationTextsUpdated += 1;
        }
        continue;
      }
      let slug = target.slugBase || kebab(target.countryCode);
      if (usedDestinationSlugs.has(slug)) slug = `${slug}-${kebab(target.countryCode)}`;
      let n = 2;
      while (usedDestinationSlugs.has(slug)) slug = `${target.slugBase}-${n++}`;
      usedDestinationSlugs.add(slug);
      const id = newId("dest");
      newDestinations.push({
        id,
        regionId: regionIdBySlug.get(target.regionSlug) ?? fallbackRegionId,
        slug,
        countryCode: target.countryCode,
        name: target.name,
        summary: target.summary,
        description: target.summary,
        popular: false,
      });
      destinationByCode.set(target.countryCode, { id } as (typeof destinationRows)[number]);
      destinationIdByKey.set(target.key, id);
      result.destinationsCreated += 1;
    }

    for (let i = 0; i < newDestinations.length; i += WRITE_BATCH) {
      await tx.insert(destinations).values(newDestinations.slice(i, i + WRITE_BATCH));
    }

    // Plans: upsert by supplier package code. Only rows whose supplier-derived
    // fields changed are written, in batches, so the daily refresh is a few
    // statements instead of one UPDATE per package.
    const existingPlans = await tx
      .select()
      .from(plans)
      .where(eq(plans.supplierKey, ESIM_ACCESS_PROVIDER_KEY));
    const planByCode = new Map(existingPlans.map((row) => [row.supplierProductId, row]));
    const allSlugs = new Set((await tx.select({ slug: plans.slug }).from(plans)).map((row) => row.slug));
    const inserts: Array<typeof plans.$inferInsert> = [];
    const changed: Array<typeof plans.$inferInsert> = [];

    for (const { pkg, costMinor } of valid) {
      const destinationId = destinationIdByKey.get(destinationTarget(pkg, labels).key)!;
      const names = countryNames(pkg);
      const priceMinor = sellingPriceFromCost(costMinor, pricing);
      const fields = {
        destinationId,
        name: pkg.name.trim(),
        dataMb: Math.max(1, Math.round(pkg.volume / BYTES_PER_MB)),
        validityDays: pkg.duration,
        costMinor,
        markupBps: effectiveMarkupBps(priceMinor, costMinor),
        priceMinor,
        currency: "USD",
        taxBps: 0,
        coverageSummary: coverageSummary(pkg, names),
        networkSummary: operatorsSummary(pkg),
        description: (pkg.description || pkg.name).trim(),
        features: features(pkg),
        status: "published",
        isDemo: false,
        supplierMetadata: supplierMetadata(pkg),
        supplierSyncedAt: now,
        updatedAt: now,
      };
      const existing = planByCode.get(pkg.packageCode);
      if (existing) {
        if (Number(existing.priceMinor) !== priceMinor || Number(existing.costMinor) !== costMinor) {
          result.repriced += 1;
        }
        // Slug (URL) is preserved; everything supplier-derived is refreshed.
        if (planFieldsChanged(existing, fields)) {
          changed.push({ ...existing, ...fields });
          result.updated += 1;
        }
        continue;
      }
      let slug = `esim-${kebab(pkg.slug)}`;
      if (allSlugs.has(slug)) slug = `${slug}-${kebab(pkg.packageCode)}`;
      allSlugs.add(slug);
      inserts.push({
        id: newId("plan"),
        slug,
        supplierKey: ESIM_ACCESS_PROVIDER_KEY,
        supplierProductId: pkg.packageCode,
        createdAt: now,
        ...fields,
      });
    }
    for (let i = 0; i < inserts.length; i += WRITE_BATCH) {
      await tx.insert(plans).values(inserts.slice(i, i + WRITE_BATCH));
    }
    result.created = inserts.length;
    const refreshSet = excludedSet(PLAN_REFRESH_KEYS);
    for (let i = 0; i < changed.length; i += WRITE_BATCH) {
      await tx
        .insert(plans)
        .values(changed.slice(i, i + WRITE_BATCH))
        .onConflictDoUpdate({ target: plans.id, set: refreshSet });
    }
    // Unchanged plans were still confirmed by this sync.
    await tx
      .update(plans)
      .set({ supplierSyncedAt: now })
      .where(and(eq(plans.supplierKey, ESIM_ACCESS_PROVIDER_KEY), eq(plans.status, "published")));

    // Archive supplier plans that disappeared or failed validation.
    const validCodes = new Set(valid.map((item) => item.pkg.packageCode));
    const invalidCodes = new Set(excluded.map((item) => item.packageCode));
    const toArchive: string[] = [];
    for (const plan of existingPlans) {
      if (validCodes.has(plan.supplierProductId) || plan.status !== "published") continue;
      toArchive.push(plan.id);
      if (invalidCodes.has(plan.supplierProductId)) result.archivedInvalid += 1;
      else result.archivedMissing += 1;
    }
    for (let i = 0; i < toArchive.length; i += WRITE_BATCH) {
      await tx
        .update(plans)
        .set({ status: "archived", updatedAt: now })
        .where(inArray(plans.id, toArchive.slice(i, i + WRITE_BATCH)));
    }

    // Hide demo/sample plans from other suppliers once real packages exist.
    if (options.hideNonSupplierPlans !== false && valid.length > 0) {
      const hidden = await tx
        .update(plans)
        .set({ status: "archived", updatedAt: now })
        .where(and(ne(plans.supplierKey, ESIM_ACCESS_PROVIDER_KEY), eq(plans.status, "published")))
        .returning({ id: plans.id });
      result.demoPlansHidden = hidden.length;
    }
  });

  await recordProviderSyncJob(db, {
    providerKey: ESIM_ACCESS_PROVIDER_KEY,
    status: "completed",
    details: {
      at: now.toISOString(),
      retrieved: result.retrieved,
      valid: result.valid,
      excluded: result.excluded.length,
      created: result.created,
      updated: result.updated,
      repriced: result.repriced,
      archivedMissing: result.archivedMissing,
      archivedInvalid: result.archivedInvalid,
      demoPlansHidden: result.demoPlansHidden,
      pricing,
    },
  });
  return result;
}

/** A successful sync is refreshed once a day. */
export const CATALOG_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** After a failure, wait before calling the supplier again. */
export const CATALOG_SYNC_FAILURE_BACKOFF_MS = 60 * 60 * 1000;
/** A "running" claim older than this is treated as crashed and can be taken over. */
export const CATALOG_SYNC_STALE_RUN_MS = 15 * 60 * 1000;

/**
 * Atomically claims the scheduled catalog sync. Returns true for exactly one
 * caller when a sync is due (none yet, last success older than a day, last
 * failure older than an hour, or a crashed run older than 15 minutes). The
 * worker runs every minute, so without this a slow sync would start again on
 * top of itself, and a failing one would call the supplier every minute.
 */
export async function claimEsimAccessSync(db: DatabaseExecutor, now = new Date()): Promise<boolean> {
  const { providerSyncJobs } = await import("@/lib/db/schema");
  const existing = await db
    .select({ id: providerSyncJobs.id })
    .from(providerSyncJobs)
    .where(eq(providerSyncJobs.providerKey, ESIM_ACCESS_PROVIDER_KEY))
    .limit(1);
  if (!existing[0]) {
    // Fixed id: concurrent first runs create one row, not two.
    await db
      .insert(providerSyncJobs)
      .values({
        id: `syncjob-${ESIM_ACCESS_PROVIDER_KEY}`,
        providerKey: ESIM_ACCESS_PROVIDER_KEY,
        status: "pending",
        startedAt: new Date(0),
        finishedAt: null,
        details: {},
      })
      .onConflictDoNothing();
  }
  const successCutoff = new Date(now.getTime() - CATALOG_SYNC_INTERVAL_MS);
  const failureCutoff = new Date(now.getTime() - CATALOG_SYNC_FAILURE_BACKOFF_MS);
  const staleCutoff = new Date(now.getTime() - CATALOG_SYNC_STALE_RUN_MS);
  const claimed = await db
    .update(providerSyncJobs)
    .set({ status: "running", startedAt: now })
    .where(
      and(
        eq(providerSyncJobs.providerKey, ESIM_ACCESS_PROVIDER_KEY),
        sql`not (
          (${providerSyncJobs.status} = 'completed' and ${providerSyncJobs.finishedAt} > ${successCutoff})
          or (${providerSyncJobs.status} = 'failed' and ${providerSyncJobs.finishedAt} > ${failureCutoff})
          or (${providerSyncJobs.status} = 'running' and ${providerSyncJobs.startedAt} > ${staleCutoff})
        )`,
      ),
    )
    .returning({ id: providerSyncJobs.id });
  return claimed.length > 0;
}

/** Last successful eSIM Access sync time. */
export async function lastEsimAccessSyncAt(db: DatabaseExecutor): Promise<Date | null> {
  const { providerSyncJobs } = await import("@/lib/db/schema");
  const rows = await db
    .select()
    .from(providerSyncJobs)
    .where(and(eq(providerSyncJobs.providerKey, ESIM_ACCESS_PROVIDER_KEY), inArray(providerSyncJobs.status, ["completed"])))
    .limit(1);
  return rows[0]?.finishedAt ?? null;
}
