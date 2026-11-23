import { and, count, desc, eq, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { destinations, orderItems, plans, regions } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { calculateSalePrice } from "@/lib/pricing";
import { parseMoneyToMinor } from "@/lib/money";

/**
 * Catalogue administration. Every mutation records an audit event with the
 * actor. Destructive operations check dependent rows first so a region or
 * destination that is referenced by the published catalogue cannot be removed
 * by accident. Plans that have ever been sold cannot be deleted at all; they
 * must be archived instead so historical order rows keep a valid plan link.
 */

export type RegionRow = typeof regions.$inferSelect;
export type DestinationRow = typeof destinations.$inferSelect;
export type PlanRow = typeof plans.$inferSelect;

export interface RegionListItem extends RegionRow {
  destinationCount: number;
}

export interface DestinationListItem extends DestinationRow {
  regionName: string;
  planCount: number;
}

export interface PlanUsage extends PlanRow {
  orderItemCount: number;
}

async function planOrderItemCount(db: Database, planId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(orderItems)
    .where(eq(orderItems.planId, planId));
  return Number(rows[0]?.value ?? 0);
}

async function destinationPlanCount(db: Database, destinationId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(plans)
    .where(eq(plans.destinationId, destinationId));
  return Number(rows[0]?.value ?? 0);
}

async function regionDestinationCount(db: Database, regionId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(destinations)
    .where(eq(destinations.regionId, regionId));
  return Number(rows[0]?.value ?? 0);
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code
    ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

export async function listCatalogueRegions(db: Database): Promise<RegionListItem[]> {
  const rows = await db.select().from(regions).orderBy(regions.sortOrder, regions.name);
  return Promise.all(
    rows.map(async (region) => ({
      ...region,
      destinationCount: await regionDestinationCount(db, region.id),
    })),
  );
}

export async function listCatalogueDestinations(
  db: Database,
): Promise<DestinationListItem[]> {
  const rows = await db
    .select({
      destination: destinations,
      regionName: regions.name,
    })
    .from(destinations)
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .orderBy(regions.sortOrder, destinations.name);
  return Promise.all(
    rows.map(async ({ destination, regionName }) => ({
      ...destination,
      regionName,
      planCount: await destinationPlanCount(db, destination.id),
    })),
  );
}

export interface CreateRegionInput {
  name: string;
  slug: string;
  description: string;
  accent: string;
  sortOrder: number;
  actorId: string;
}

export async function createRegion(db: Database, input: CreateRegionInput): Promise<RegionRow> {
  const id = newId("region");
  const region = {
    id,
    slug: input.slug,
    name: input.name,
    description: input.description,
    accent: input.accent,
    sortOrder: input.sortOrder,
    createdAt: new Date(),
  };
  try {
    await db.insert(regions).values(region);
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("A region with that slug already exists");
    throw error;
  }
  await recordAudit(db, {
    actorType: "admin",
    actorId: input.actorId,
    action: "admin.region.create",
    entityType: "region",
    entityId: id,
    metadata: { slug: input.slug, name: input.name },
  });
  return region;
}

export async function updateRegion(
  db: Database,
  input: CreateRegionInput & { id: string },
): Promise<void> {
  const existing = await db.select().from(regions).where(eq(regions.id, input.id)).limit(1);
  const region = existing[0];
  if (!region) throw new Error("Region not found");
  if (region.slug !== input.slug) {
    const conflict = await db
      .select({ id: regions.id })
      .from(regions)
      .where(and(eq(regions.slug, input.slug), ne(regions.id, region.id)))
      .limit(1);
    if (conflict[0]) throw new Error("A region with that slug already exists");
  }
  await db
    .update(regions)
    .set({
      slug: input.slug,
      name: input.name,
      description: input.description,
      accent: input.accent,
      sortOrder: input.sortOrder,
    })
    .where(eq(regions.id, region.id));
  await recordAudit(db, {
    actorType: "admin",
    actorId: input.actorId,
    action: "admin.region.update",
    entityType: "region",
    entityId: region.id,
    metadata: {
      previousSlug: region.slug,
      slug: input.slug,
      name: input.name,
      sortOrder: input.sortOrder,
    },
  });
}

export async function deleteRegion(
  db: Database,
  id: string,
  actorId: string,
): Promise<void> {
  const existing = await db.select().from(regions).where(eq(regions.id, id)).limit(1);
  const region = existing[0];
  if (!region) throw new Error("Region not found");
  const destinationsInRegion = await regionDestinationCount(db, region.id);
  if (destinationsInRegion > 0) {
    throw new Error(
      `Region still contains ${destinationsInRegion} destination(s). Move or archive them first.`,
    );
  }
  await db.delete(regions).where(eq(regions.id, region.id));
  await recordAudit(db, {
    actorType: "admin",
    actorId,
    action: "admin.region.delete",
    entityType: "region",
    entityId: region.id,
    metadata: { slug: region.slug, name: region.name },
  });
}

export interface CreateDestinationInput {
  regionId: string;
  name: string;
  slug: string;
  countryCode: string;
  summary: string;
  description: string;
  popular: boolean;
  actorId: string;
}

export async function createDestination(
  db: Database,
  input: CreateDestinationInput,
): Promise<DestinationRow> {
  const regionRows = await db
    .select({ id: regions.id })
    .from(regions)
    .where(eq(regions.id, input.regionId))
    .limit(1);
  if (!regionRows[0]) throw new Error("Choose a valid region");
  const id = newId("destination");
  const destination = {
    id,
    regionId: input.regionId,
    slug: input.slug,
    countryCode: input.countryCode,
    name: input.name,
    summary: input.summary,
    description: input.description,
    popular: input.popular,
    createdAt: new Date(),
  };
  try {
    await db.insert(destinations).values(destination);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A destination with that slug already exists");
    }
    throw error;
  }
  await recordAudit(db, {
    actorType: "admin",
    actorId: input.actorId,
    action: "admin.destination.create",
    entityType: "destination",
    entityId: id,
    metadata: { slug: input.slug, name: input.name, regionId: input.regionId },
  });
  return destination;
}

export async function updateDestination(
  db: Database,
  input: CreateDestinationInput & { id: string },
): Promise<void> {
  const existing = await db
    .select()
    .from(destinations)
    .where(eq(destinations.id, input.id))
    .limit(1);
  const destination = existing[0];
  if (!destination) throw new Error("Destination not found");
  const regionRows = await db
    .select({ id: regions.id })
    .from(regions)
    .where(eq(regions.id, input.regionId))
    .limit(1);
  if (!regionRows[0]) throw new Error("Choose a valid region");
  if (destination.slug !== input.slug) {
    const conflict = await db
      .select({ id: destinations.id })
      .from(destinations)
      .where(
        and(eq(destinations.slug, input.slug), ne(destinations.id, destination.id)),
      )
      .limit(1);
    if (conflict[0]) throw new Error("A destination with that slug already exists");
  }
  await db
    .update(destinations)
    .set({
      regionId: input.regionId,
      slug: input.slug,
      countryCode: input.countryCode,
      name: input.name,
      summary: input.summary,
      description: input.description,
      popular: input.popular,
    })
    .where(eq(destinations.id, destination.id));
  await recordAudit(db, {
    actorType: "admin",
    actorId: input.actorId,
    action: "admin.destination.update",
    entityType: "destination",
    entityId: destination.id,
    metadata: {
      previousSlug: destination.slug,
      slug: input.slug,
      name: input.name,
      regionId: input.regionId,
    },
  });
}

export async function deleteDestination(
  db: Database,
  id: string,
  actorId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(destinations)
    .where(eq(destinations.id, id))
    .limit(1);
  const destination = existing[0];
  if (!destination) throw new Error("Destination not found");
  const plansInDestination = await destinationPlanCount(db, destination.id);
  if (plansInDestination > 0) {
    throw new Error(
      `Destination still contains ${plansInDestination} plan(s). Archive or move them first.`,
    );
  }
  await db.delete(destinations).where(eq(destinations.id, destination.id));
  await recordAudit(db, {
    actorType: "admin",
    actorId,
    action: "admin.destination.delete",
    entityType: "destination",
    entityId: destination.id,
    metadata: { slug: destination.slug, name: destination.name },
  });
}

function featuresArray(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export interface CreatePlanInput {
  destinationId: string;
  name: string;
  slug: string;
  supplierKey: string;
  supplierProductId: string;
  dataMb: number;
  validityDays: number;
  cost: string;
  markupBps: number;
  currency: string;
  taxBps: number;
  coverageSummary: string;
  networkSummary: string;
  description: string;
  features?: string | undefined;
  status: "published" | "draft" | "archived";
  isDemo: boolean;
  actorId: string;
}

export type UpdatePlanInput = CreatePlanInput & { id: string };

function buildPlanValues(input: CreatePlanInput) {
  const destinationId = input.destinationId;
  const costMinor = parseMoneyToMinor(input.cost, input.currency);
  const priceMinor = calculateSalePrice(costMinor, input.markupBps);
  return {
    destinationId,
    slug: input.slug,
    name: input.name,
    supplierKey: input.supplierKey,
    supplierProductId: input.supplierProductId,
    dataMb: input.dataMb,
    validityDays: input.validityDays,
    costMinor,
    markupBps: input.markupBps,
    priceMinor,
    currency: input.currency,
    taxBps: input.taxBps,
    coverageSummary: input.coverageSummary,
    networkSummary: input.networkSummary,
    description: input.description,
    features: featuresArray(input.features),
    status: input.status,
    isDemo: input.isDemo,
  };
}

export async function createPlan(db: Database, input: CreatePlanInput): Promise<PlanRow> {
  const destinationRows = await db
    .select({ id: destinations.id })
    .from(destinations)
    .where(eq(destinations.id, input.destinationId))
    .limit(1);
  if (!destinationRows[0]) throw new Error("Choose a valid destination");
  const values = {
    id: newId("plan"),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...buildPlanValues(input),
  };
  try {
    await db.insert(plans).values(values);
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("A plan with that slug already exists");
    throw error;
  }
  await recordAudit(db, {
    actorType: "admin",
    actorId: input.actorId,
    action: "admin.plan.create",
    entityType: "plan",
    entityId: values.id,
    metadata: {
      slug: values.slug,
      name: values.name,
      destinationId: input.destinationId,
      status: values.status,
      isDemo: values.isDemo,
      priceMinor: values.priceMinor,
    },
  });
  return values as PlanRow;
}

export async function updatePlan(db: Database, input: UpdatePlanInput): Promise<void> {
  const existing = await db.select().from(plans).where(eq(plans.id, input.id)).limit(1);
  const plan = existing[0];
  if (!plan) throw new Error("Plan not found");
  const destinationRows = await db
    .select({ id: destinations.id })
    .from(destinations)
    .where(eq(destinations.id, input.destinationId))
    .limit(1);
  if (!destinationRows[0]) throw new Error("Choose a valid destination");
  if (plan.slug !== input.slug) {
    const conflict = await db
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.slug, input.slug), ne(plans.id, plan.id)))
      .limit(1);
    if (conflict[0]) throw new Error("A plan with that slug already exists");
  }
  const values = buildPlanValues(input);
  await db
    .update(plans)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(plans.id, plan.id));
  await recordAudit(db, {
    actorType: "admin",
    actorId: input.actorId,
    action: "admin.plan.update",
    entityType: "plan",
    entityId: plan.id,
    metadata: {
      previousSlug: plan.slug,
      slug: values.slug,
      name: values.name,
      status: values.status,
      markupBps: values.markupBps,
      priceMinor: values.priceMinor,
      isDemo: values.isDemo,
    },
  });
}

export async function deletePlan(db: Database, id: string, actorId: string): Promise<void> {
  const existing = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  const plan = existing[0];
  if (!plan) throw new Error("Plan not found");
  const lineCount = await planOrderItemCount(db, plan.id);
  if (lineCount > 0) {
    throw new Error(
      `Plan has been sold in ${lineCount} order line(s). Archive it instead of deleting.`,
    );
  }
  await db.delete(plans).where(eq(plans.id, plan.id));
  await recordAudit(db, {
    actorType: "admin",
    actorId,
    action: "admin.plan.delete",
    entityType: "plan",
    entityId: plan.id,
    metadata: { slug: plan.slug, name: plan.name },
  });
}

export async function listPlansWithOrderUsage(db: Database): Promise<PlanUsage[]> {
  const rows = await db
    .select()
    .from(plans)
    .orderBy(desc(plans.updatedAt));
  return Promise.all(
    rows.map(async (plan) => ({
      ...plan,
      orderItemCount: await planOrderItemCount(db, plan.id),
    })),
  );
}
