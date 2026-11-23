"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import {
  createDestination,
  createPlan,
  createRegion,
  deleteDestination,
  deletePlan,
  deleteRegion,
  updateDestination,
  updatePlan,
  updateRegion,
} from "@/lib/catalogue";
import {
  catalogueDestinationSchema,
  cataloguePlanSchema,
  catalogueRegionSchema,
  formString,
  zodMessage,
} from "@/lib/validation";

function catalogueError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function back(path: string, params: Record<string, string>): never {
  const search = new URLSearchParams(params).toString();
  redirect(`${path}?${search}`);
}

export async function upsertRegionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/plans/regions", "plans.manage");
  const parsed = catalogueRegionSchema.safeParse({
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    description: formString(formData, "description"),
    accent: formString(formData, "accent"),
    sortOrder: formString(formData, "sortOrder"),
  });
  if (!parsed.success) {
    back("/admin/plans/regions", { error: zodMessage(parsed.error) });
  }
  const id = formString(formData, "regionId");
  const db = await getDb();
  try {
    if (id) {
      await updateRegion(db, { ...parsed.data, id, actorId: admin.id });
    } else {
      await createRegion(db, { ...parsed.data, actorId: admin.id });
    }
  } catch (error) {
    back("/admin/plans/regions", { error: catalogueError(error, "Region could not be saved") });
  }
  revalidatePath("/admin/plans/regions");
  revalidatePath("/admin/plans");
  revalidatePath("/destinations");
  back("/admin/plans/regions", { saved: "1" });
}

export async function deleteRegionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/plans/regions", "plans.manage");
  const id = formString(formData, "regionId");
  const db = await getDb();
  try {
    await deleteRegion(db, id, admin.id);
  } catch (error) {
    back("/admin/plans/regions", { error: catalogueError(error, "Region could not be deleted") });
  }
  revalidatePath("/admin/plans/regions");
  revalidatePath("/destinations");
  back("/admin/plans/regions", { saved: "deleted" });
}

export async function upsertDestinationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/plans/destinations", "plans.manage");
  const parsed = catalogueDestinationSchema.safeParse({
    regionId: formString(formData, "regionId"),
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    countryCode: formString(formData, "countryCode"),
    summary: formString(formData, "summary"),
    description: formString(formData, "description"),
    popular: formString(formData, "popular"),
  });
  if (!parsed.success) {
    back("/admin/plans/destinations", { error: zodMessage(parsed.error) });
  }
  const id = formString(formData, "destinationId");
  const input = {
    ...parsed.data,
    countryCode: parsed.data.countryCode.toUpperCase(),
    popular: parsed.data.popular === "on",
    actorId: admin.id,
  };
  const db = await getDb();
  try {
    if (id) {
      await updateDestination(db, { ...input, id });
    } else {
      await createDestination(db, input);
    }
  } catch (error) {
    back("/admin/plans/destinations", {
      error: catalogueError(error, "Destination could not be saved"),
    });
  }
  revalidatePath("/admin/plans/destinations");
  revalidatePath("/admin/plans");
  revalidatePath("/destinations");
  revalidatePath(`/destinations/${parsed.data.slug}`);
  back("/admin/plans/destinations", { saved: "1" });
}

export async function deleteDestinationAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/plans/destinations", "plans.manage");
  const id = formString(formData, "destinationId");
  const db = await getDb();
  try {
    await deleteDestination(db, id, admin.id);
  } catch (error) {
    back("/admin/plans/destinations", {
      error: catalogueError(error, "Destination could not be deleted"),
    });
  }
  revalidatePath("/admin/plans/destinations");
  revalidatePath("/destinations");
  back("/admin/plans/destinations", { saved: "deleted" });
}

export async function upsertPlanAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/plans", "plans.manage");
  const parsed = cataloguePlanSchema.safeParse({
    destinationId: formString(formData, "destinationId"),
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    supplierKey: formString(formData, "supplierKey"),
    supplierProductId: formString(formData, "supplierProductId"),
    dataMb: formString(formData, "dataMb"),
    validityDays: formString(formData, "validityDays"),
    cost: formString(formData, "cost"),
    markupBps: formString(formData, "markupBps"),
    currency: formString(formData, "currency"),
    taxBps: formString(formData, "taxBps"),
    coverageSummary: formString(formData, "coverageSummary"),
    networkSummary: formString(formData, "networkSummary"),
    description: formString(formData, "description"),
    features: formString(formData, "features"),
    status: formString(formData, "status"),
    isDemo: formString(formData, "isDemo"),
  });
  if (!parsed.success) {
    back("/admin/plans", { error: zodMessage(parsed.error) });
  }
  const id = formString(formData, "planId");
  const input = {
    ...parsed.data,
    features: parsed.data.features === "" ? undefined : parsed.data.features,
    isDemo: parsed.data.isDemo === "on",
    actorId: admin.id,
  };
  const db = await getDb();
  try {
    if (id) {
      await updatePlan(db, { ...input, id });
    } else {
      await createPlan(db, input);
    }
  } catch (error) {
    back("/admin/plans", { error: catalogueError(error, "Plan could not be saved") });
  }
  revalidatePath("/admin/plans");
  revalidatePath("/plans");
  revalidatePath(`/plans/${parsed.data.slug}`);
  revalidatePath("/");
  back("/admin/plans", { saved: "1" });
}

export async function deletePlanAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/plans", "plans.manage");
  const id = formString(formData, "planId");
  const db = await getDb();
  try {
    await deletePlan(db, id, admin.id);
  } catch (error) {
    back("/admin/plans", { error: catalogueError(error, "Plan could not be deleted") });
  }
  revalidatePath("/admin/plans");
  revalidatePath("/plans");
  back("/admin/plans", { saved: "deleted" });
}
