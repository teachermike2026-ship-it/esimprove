/**
 * eSIM Access catalog integration with SYNTHETIC package data only.
 * No request reaches eSIM Access: the client gets a fake fetch, and the sync
 * gets an in-memory package list.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { destinations, orders, plans, providerSyncJobs } from "@/lib/db/schema";
import { recordProviderSyncJob } from "@/lib/operations";
import {
  fetchEsimAccessPackages,
  signEsimAccessRequest,
  type EsimAccessPackage,
} from "@/lib/integrations/supplier/esimaccess";
import { ProviderError } from "@/lib/integrations/supplier/types";
import {
  netProfitMinor,
  pricingPolicy,
  sellingPriceFromCost,
  type PricingPolicy,
} from "@/lib/pricing-config";

const POLICY: PricingPolicy = { targetNetProfitMinor: 300, feeBps: 420, feeFixedMinor: 30 };
import {
  CatalogSyncAbortedError,
  CATALOG_SYNC_FAILURE_BACKOFF_MS,
  CATALOG_SYNC_INTERVAL_MS,
  CATALOG_SYNC_STALE_RUN_MS,
  claimEsimAccessSync,
  planFieldsChanged,
  runEsimAccessCatalogSync,
  validatePackage,
} from "@/lib/supplier-catalog/esimaccess-sync";
import {
  regionSlugForCountry,
  regionSlugForMultiCode,
} from "@/lib/supplier-catalog/esimaccess-regions";
import { getDestinations, getPlanBySlug } from "@/lib/catalog";
import { makeTestDb } from "./helpers/db";

function pkg(overrides: Partial<EsimAccessPackage> = {}): EsimAccessPackage {
  return {
    packageCode: "CKH002",
    slug: "ES_3_30",
    name: "Spain 3GB 30Days",
    price: 16000,
    currencyCode: "USD",
    volume: 3 * 1024 * 1024 * 1024,
    smsStatus: 0,
    dataType: 1,
    unusedValidTime: 180,
    duration: 30,
    durationUnit: "DAY",
    location: "ES",
    locationCode: "ES",
    description: "Spain 3GB 30Days",
    activeType: 2,
    retailPrice: 32000,
    speed: "3G/4G/5G",
    ipExport: "FR/NL/UK",
    supportTopUpType: 2,
    fupPolicy: "",
    locationNetworkList: [
      {
        locationName: "Spain",
        locationCode: "ES",
        operatorList: [{ operatorName: "Orange", networkType: "5G" }],
      },
    ],
    ...overrides,
  };
}

const EUROPE = pkg({
  packageCode: "CKH006",
  slug: "EU-42_3_30",
  name: "Europe 3GB 30Days",
  price: 50000,
  location: "FR,DE,ES",
  locationCode: "EU-42",
  locationNetworkList: [
    { locationName: "France", locationCode: "FR", operatorList: [] },
    { locationName: "Germany", locationCode: "DE", operatorList: [] },
    { locationName: "Spain", locationCode: "ES", operatorList: [] },
  ],
});
const GLOBAL = pkg({
  packageCode: "GL001",
  slug: "GL-120_1_7",
  name: "Global (120+ areas) 1GB 7Days",
  price: 75000,
  location: "US,JP,FR",
  locationCode: "GL-120",
  duration: 7,
});
const DAYPASS = pkg({
  packageCode: "DP001",
  slug: "SG_1_Daily",
  name: "Singapore 1GB/Day",
  price: 9000,
  dataType: 2,
  duration: 1,
  location: "SG",
  locationCode: "SG",
  fupPolicy: "384 Kbps",
  locationNetworkList: [{ locationName: "Singapore", locationCode: "SG", operatorList: [] }],
});

describe("eSIM Access request signing and client", () => {
  it("matches the signature example in the official documentation", () => {
    const signature = signEsimAccessRequest({
      timestamp: "1628670421",
      requestId: "4ce9d9cdac9e4e17b3a2c66c358c1ce2",
      accessCode: "11111",
      body: '{"imsi":"326543826"}',
      secretKey: "1111",
    });
    expect(signature).toBe("7EB765E27DF5373DEA2DBC8C41A7D9557743E46C8054750F3D851B3FD01D0835".toLowerCase());
  });

  it("calls only the package-list endpoint with signed headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const list = await fetchEsimAccessPackages({
      credentials: { accessCode: "ac_synthetic", secretKey: "sk_synthetic" },
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init! });
        return new Response(
          JSON.stringify({ success: true, errorCode: null, obj: { packageList: [pkg()] } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });
    expect(list).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.esimaccess.com/api/v1/open/package/list");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["RT-AccessCode"]).toBe("ac_synthetic");
    expect(headers["RT-Signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers["RT-Signature"]).toBe(
      signEsimAccessRequest({
        timestamp: headers["RT-Timestamp"]!,
        requestId: headers["RT-RequestID"]!,
        accessCode: "ac_synthetic",
        body: String(calls[0]!.init.body),
        secretKey: "sk_synthetic",
      }),
    );
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ type: "BASE", locationCode: "" });
  });

  it("reports supplier and transport errors without secrets", async () => {
    const failing = (body: unknown, status = 200) =>
      fetchEsimAccessPackages({
        credentials: { accessCode: "ac_synthetic", secretKey: "sk_synthetic" },
        fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as typeof fetch,
      });
    const signature = await failing({ success: false, errorCode: "101003", errorMsg: "Request signature mismatch." }).catch((e: unknown) => e);
    expect(signature).toBeInstanceOf(ProviderError);
    expect((signature as ProviderError).code).toBe("esimaccess_101003");
    expect(String((signature as Error).message)).not.toContain("sk_synthetic");
    await expect(failing({}, 429)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(failing({ success: true, obj: {} })).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("pricing configuration", () => {
  it("guarantees the $3 target net profit after the documented card fee", () => {
    expect(pricingPolicy({} as NodeJS.ProcessEnv)).toEqual(POLICY);
    expect(
      pricingPolicy({
        ESIMPROVE_TARGET_NET_PROFIT_USD: "2.50",
        ESIMPROVE_CARD_FEE_PERCENT: "2.7",
        ESIMPROVE_CARD_FEE_FIXED_USD: "0.30",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ targetNetProfitMinor: 250, feeBps: 270, feeFixedMinor: 30 });
    expect(() => pricingPolicy({ ESIMPROVE_CARD_FEE_PERCENT: "abc" } as unknown as NodeJS.ProcessEnv)).toThrow();
    expect(() => pricingPolicy({ ESIMPROVE_CARD_FEE_PERCENT: "60" } as unknown as NodeJS.ProcessEnv)).toThrow();

    // Spain 3GB: cost $1.60 -> $5.12; net after 4.2% + $0.30 = $3.0049.
    expect(sellingPriceFromCost(160, POLICY)).toBe(512);
    for (let cost = 1; cost <= 50_000; cost += 37) {
      const price = sellingPriceFromCost(cost, POLICY);
      const net = netProfitMinor(price, cost, POLICY);
      expect(net).toBeGreaterThanOrEqual(300);
      expect(net).toBeLessThan(302); // never more than ~1 cent above target from rounding
    }
    // Without fees the price is exactly cost + $3.
    expect(sellingPriceFromCost(160, { targetNetProfitMinor: 300, feeBps: 0, feeFixedMinor: 0 })).toBe(460);
    expect(() => sellingPriceFromCost(0, POLICY)).toThrow();
  });

  it("only accepts packages with a verified whole-cent USD cost", () => {
    expect(validatePackage(pkg())).toEqual({ costMinor: 160 });
    expect(validatePackage(pkg({ price: 0 }))).toMatchObject({ reason: expect.stringMatching(/price/) });
    expect(validatePackage(pkg({ price: 16050 }))).toMatchObject({ reason: expect.stringMatching(/whole cent/) });
    expect(validatePackage(pkg({ currencyCode: "EUR" }))).toMatchObject({ reason: expect.stringMatching(/currency/) });
    expect(validatePackage(pkg({ durationUnit: "HOUR" }))).toMatchObject({ reason: expect.stringMatching(/validity/) });
  });
});

describe("region mapping", () => {
  it("maps countries and multi-country codes to storefront regions", () => {
    expect(regionSlugForCountry("FR")).toBe("europe");
    expect(regionSlugForCountry("JP")).toBe("asia");
    expect(regionSlugForCountry("ZZ")).toBe("global");
    expect(regionSlugForMultiCode("EU-42", ["FR", "DE"])).toBe("europe");
    expect(regionSlugForMultiCode("GL-120", ["US", "JP"])).toBe("global");
    expect(regionSlugForMultiCode("SAAEQAKWOMBH-6", ["SA", "AE", "QA", "KW", "OM", "BH"])).toBe("middle-east");
  });
});

describe("eSIM Access catalog sync", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  async function publishedBySupplier(key: string) {
    return handle.db
      .select()
      .from(plans)
      .where(and(eq(plans.supplierKey, key), eq(plans.status, "published")));
  }

  it("aborts without changes when the supplier fails or returns nothing usable", async () => {
    const before = await publishedBySupplier("mock");
    expect(before.length).toBeGreaterThan(0);
    await expect(
      runEsimAccessCatalogSync(handle.db, {
        fetchPackages: async () => {
          throw new ProviderError("network", "down", true);
        },
      }),
    ).rejects.toBeInstanceOf(ProviderError);
    await expect(runEsimAccessCatalogSync(handle.db, { fetchPackages: async () => [] })).rejects.toBeInstanceOf(
      CatalogSyncAbortedError,
    );
    await expect(
      runEsimAccessCatalogSync(handle.db, {
        fetchPackages: async () => [pkg({ price: 0 }), pkg({ packageCode: "X2", slug: "X_2", price: 0 }), pkg({ packageCode: "X3", slug: "X_3" })],
      }),
    ).rejects.toBeInstanceOf(CatalogSyncAbortedError);
    expect(await publishedBySupplier("mock")).toHaveLength(before.length);
    expect(await publishedBySupplier("esimaccess")).toHaveLength(0);
  });

  it("imports real packages at the net-profit price and hides demo products", async () => {
    const ordersBefore = await handle.db.select().from(orders);
    // Older demo seeds described destinations as demo/illustrative.
    await handle.db
      .update(destinations)
      .set({
        summary: "Demo eSIM plans for Spain. Coverage and network details are illustrative only.",
        description: "This is a clearly labelled demo destination page for Spain.",
      })
      .where(eq(destinations.slug, "spain"));
    const result = await runEsimAccessCatalogSync(handle.db, {
      fetchPackages: async () => [pkg(), EUROPE, GLOBAL, DAYPASS],
      pricing: POLICY,
    });
    expect(result).toMatchObject({
      retrieved: 4,
      valid: 4,
      created: 4,
      countryPackages: 2,
      regionalPackages: 1,
      globalPackages: 1,
    });
    expect(result.demoPlansHidden).toBeGreaterThan(0);
    expect(await publishedBySupplier("mock")).toHaveLength(0);

    const spain = (await handle.db.select().from(plans).where(eq(plans.supplierProductId, "CKH002")))[0]!;
    expect(spain).toMatchObject({
      costMinor: 160,
      priceMinor: 512,
      dataMb: 3072,
      validityDays: 30,
      isDemo: false,
      slug: "esim-es-3-30",
    });
    expect(spain.networkSummary).toContain("Orange");
    // Existing "spain" destination is reused (its URL is preserved).
    const spainDestination = (await handle.db.select().from(destinations).where(eq(destinations.id, spain.destinationId)))[0]!;
    expect(spainDestination.slug).toBe("spain");
    // Old demo wording on reused destinations is replaced.
    expect(`${spainDestination.summary} ${spainDestination.description}`).not.toMatch(/demo|illustrative/i);
    expect(result.destinationTextsUpdated).toBeGreaterThan(0);

    const europe = (await handle.db.select().from(plans).where(eq(plans.supplierProductId, "CKH006")))[0]!;
    const europeDestination = (await handle.db.select().from(destinations).where(eq(destinations.id, europe.destinationId)))[0]!;
    expect(europeDestination.countryCode).toBe("EU-42");
    expect(europe.coverageSummary).toContain("3 countries");

    const daypass = (await handle.db.select().from(plans).where(eq(plans.supplierProductId, "DP001")))[0]!;
    expect(daypass.features.join(" ")).toContain("per day");

    // Storefront: every visible destination has a real plan; demo pages 404.
    const visible = await getDestinations(handle.db);
    expect(visible.every((destination) => destination.planCount > 0)).toBe(true);
    const archivedDemo = (await handle.db.select().from(plans).where(eq(plans.supplierKey, "mock")))[0]!;
    expect((await getPlanBySlug(handle.db, archivedDemo.slug))?.status).toBe("archived");

    // Historical orders untouched.
    expect(await handle.db.select().from(orders)).toHaveLength(ordersBefore.length);
  });

  it("is idempotent, reprices from cost, archives missing packages, and keeps URLs", async () => {
    const before = (await handle.db.select().from(plans).where(eq(plans.supplierProductId, "CKH002")))[0]!;
    const resyncAt = new Date(Date.now() + 60_000);
    const again = await runEsimAccessCatalogSync(handle.db, {
      fetchPackages: async () => [pkg(), EUROPE, GLOBAL, DAYPASS],
      pricing: POLICY,
      now: resyncAt,
    });
    // Nothing changed at the supplier: no plan rows are rewritten...
    expect(again).toMatchObject({ created: 0, updated: 0, repriced: 0, destinationsCreated: 0 });
    const spain = (await handle.db.select().from(plans).where(eq(plans.supplierProductId, "CKH002")))[0]!;
    expect(spain.priceMinor).toBe(512);
    expect(spain.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    // ...but every published plan is marked as confirmed by this sync.
    expect(spain.supplierSyncedAt?.getTime()).toBe(resyncAt.getTime());

    // Supplier cost rises and the supplier slug changes; Global disappears.
    const next = await runEsimAccessCatalogSync(handle.db, {
      fetchPackages: async () => [pkg({ price: 20000, slug: "ES_3_30_NEW" }), EUROPE, DAYPASS],
      pricing: POLICY,
    });
    expect(next).toMatchObject({ repriced: 1, updated: 1, archivedMissing: 1 });
    const repriced = (await handle.db.select().from(plans).where(eq(plans.supplierProductId, "CKH002")))[0]!;
    expect(repriced).toMatchObject({ costMinor: 200, priceMinor: 554, slug: "esim-es-3-30" });
    const global = (await handle.db.select().from(plans).where(eq(plans.supplierProductId, "GL001")))[0]!;
    expect(global.status).toBe("archived");

    // Duplicate package codes in a response are imported once.
    const dup = await runEsimAccessCatalogSync(handle.db, {
      fetchPackages: async () => [pkg({ price: 20000 }), pkg({ price: 20000 }), EUROPE, DAYPASS],
      pricing: POLICY,
    });
    expect(dup.excluded).toEqual([{ packageCode: "CKH002", reason: "duplicate packageCode in supplier response" }]);
    const rows = await handle.db.select().from(plans).where(eq(plans.supplierProductId, "CKH002"));
    expect(rows).toHaveLength(1);
  });
});

describe("catalog sync change detection", () => {
  const base = {
    name: "Spain 3GB 30Days",
    costMinor: 160,
    priceMinor: 512,
    features: ["5G", "Hotspot"],
    supplierMetadata: { packageCode: "CKH002", countries: ["ES"], speed: "5G" },
    status: "published",
  };

  it("ignores jsonb key order, numeric strings and timestamps", () => {
    const fromDb = {
      ...base,
      costMinor: "160" as unknown as number,
      supplierMetadata: { speed: "5G", countries: ["ES"], packageCode: "CKH002" },
      updatedAt: new Date(0),
    };
    expect(planFieldsChanged(fromDb, { ...base, updatedAt: new Date() })).toBe(false);
  });

  it("detects real supplier changes", () => {
    expect(planFieldsChanged(base, { ...base, costMinor: 170 })).toBe(true);
    expect(planFieldsChanged(base, { ...base, features: ["4G"] })).toBe(true);
    expect(planFieldsChanged(base, { ...base, supplierMetadata: { ...base.supplierMetadata, speed: "4G" } })).toBe(true);
    expect(planFieldsChanged({ ...base, status: "archived" }, base)).toBe(true);
  });
});

describe("scheduled catalog sync claim", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await makeTestDb();
  });

  afterAll(async () => {
    await handle.close();
  });

  it("lets exactly one worker sync, then waits a day after success and an hour after failure", async () => {
    const t0 = new Date("2026-11-26T00:00:00Z");
    const at = (ms: number) => new Date(t0.getTime() + ms);

    // First run: concurrent workers, one claim.
    const claims = await Promise.all([claimEsimAccessSync(handle.db, t0), claimEsimAccessSync(handle.db, t0)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await handle.db.select().from(providerSyncJobs)).toHaveLength(1);

    // While running (not stale), nobody else claims; a crashed run is taken over.
    expect(await claimEsimAccessSync(handle.db, at(60_000))).toBe(false);
    expect(await claimEsimAccessSync(handle.db, at(CATALOG_SYNC_STALE_RUN_MS + 1))).toBe(true);

    // Success: next sync only after the daily interval.
    await recordProviderSyncJob(handle.db, { providerKey: "esimaccess", status: "completed" });
    const done = (await handle.db.select().from(providerSyncJobs))[0]!.finishedAt!;
    const after = (ms: number) => new Date(done.getTime() + ms);
    expect(await claimEsimAccessSync(handle.db, after(60_000))).toBe(false);
    expect(await claimEsimAccessSync(handle.db, after(CATALOG_SYNC_INTERVAL_MS + 1))).toBe(true);

    // Failure: back off for an hour instead of retrying every minute.
    await recordProviderSyncJob(handle.db, { providerKey: "esimaccess", status: "failed" });
    const failed = (await handle.db.select().from(providerSyncJobs))[0]!.finishedAt!;
    expect(await claimEsimAccessSync(handle.db, new Date(failed.getTime() + 60_000))).toBe(false);
    expect(await claimEsimAccessSync(handle.db, new Date(failed.getTime() + CATALOG_SYNC_FAILURE_BACKOFF_MS + 1))).toBe(true);
  });
});
