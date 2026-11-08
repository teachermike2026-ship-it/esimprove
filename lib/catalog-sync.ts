import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { destinations, plans, regions } from "@/lib/db/schema";
import { getSupplierAdapter } from "@/lib/integrations/supplier";
import type { SupplierCatalogEntry } from "@/lib/integrations/supplier/types";
import { recordProviderSyncJob } from "@/lib/operations";
import { newId } from "@/lib/ids";

export interface CatalogSyncResult {
  providerKey: string;
  status: "completed" | "failed";
  created: number;
  updated: number;
  skipped: number;
  archived: number;
  syncedAt: Date;
  error?: string;
}

/**
 * Controlled catalog synchronization. Upserts provider plan data into the
 * local catalogue, archives plans that disappeared from the provider, and
 * records the last successful synchronization.
 */
export async function runCatalogSync(
  db: Database,
  providerKey: string,
): Promise<CatalogSyncResult> {
  try {
    const adapter = getSupplierAdapter();
    const entries: SupplierCatalogEntry[] = (await adapter.fetchCatalog?.()) ?? [];
    const now = new Date();

    const existingPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.supplierKey, providerKey));
    const existingByProduct = new Map(
      existingPlans.map((plan) => [plan.supplierProductId, plan]),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let archived = 0;

    for (const entry of entries) {
      const existing = existingByProduct.get(entry.supplierProductId);
      if (existing) {
        updated += 1;
        await db
          .update(plans)
          .set({
            name: entry.planName,
            dataMb: entry.dataMb,
            validityDays: entry.validityDays,
            costMinor: entry.costMinor,
            markupBps: existing.markupBps,
            priceMinor: existing.priceMinor,
            coverageSummary: entry.coverageSummary,
            networkSummary: entry.networkSummary,
            updatedAt: now,
          })
          .where(eq(plans.id, existing.id));
        continue;
      }

      const destinationRows = await db
        .select()
        .from(destinations)
        .where(eq(destinations.slug, entry.destinationSlug ?? "japan"))
        .limit(1);
      const destination = destinationRows[0];
      if (!destination) {
        skipped += 1;
        continue;
      }

      await db.insert(plans).values({
        id: newId("plan"),
        destinationId: destination.id,
        slug: `sync-${entry.supplierProductId}`,
        name: entry.planName,
        supplierKey: providerKey,
        supplierProductId: entry.supplierProductId,
        dataMb: entry.dataMb,
        validityDays: entry.validityDays,
        costMinor: entry.costMinor,
        markupBps: 2_500,
        priceMinor: entry.costMinor,
        currency: entry.currency,
        taxBps: 0,
        coverageSummary: entry.coverageSummary,
        networkSummary: entry.networkSummary,
        description: entry.coverageSummary,
        features: [],
        status: "published",
        isDemo: true,
      });
      created += 1;
    }

    const knownProductIds = new Set(entries.map((entry) => entry.supplierProductId));
    const stalePlans = existingPlans.filter(
      (plan) => !knownProductIds.has(plan.supplierProductId) && plan.status === "published",
    );
    for (const plan of stalePlans) {
      await db
        .update(plans)
        .set({ status: "archived", updatedAt: now })
        .where(eq(plans.id, plan.id));
      archived += 1;
    }

    await recordProviderSyncJob(db, {
      providerKey,
      status: "completed",
      details: { created, updated, skipped, archived },
    });

    return {
      providerKey,
      status: "completed",
      created,
      updated,
      skipped,
      archived,
      syncedAt: now,
    };
  } catch (error) {
    await recordProviderSyncJob(db, {
      providerKey,
      status: "failed",
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

export async function listPlansForProvider(db: Database, providerKey: string) {
  return db
    .select()
    .from(plans)
    .where(eq(plans.supplierKey, providerKey))
    .orderBy(plans.updatedAt);
}

export async function listRegions(db: Database) {
  return db.select().from(regions);
}

export async function listDestinationsForRegion(db: Database, regionId: string) {
  return db
    .select()
    .from(destinations)
    .where(eq(destinations.regionId, regionId))
    .orderBy(destinations.name);
}
