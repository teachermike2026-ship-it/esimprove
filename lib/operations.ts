import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  adminSettings,
  apiHealthChecks,
  providerBalanceSnapshots,
  providerSyncJobs,
  systemSettings,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export async function getAdminSetting(
  db: Database,
  key: string,
): Promise<Record<string, unknown> | null> {
  const rows = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
  const row = rows[0];
  return row?.value ?? null;
}

export async function updateAdminSetting(
  db: Database,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  const existing = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
  const now = new Date();
  if (existing[0]) {
    await db
      .update(adminSettings)
      .set({ value, updatedAt: now })
      .where(eq(adminSettings.key, key));
    return;
  }
  await db.insert(adminSettings).values({ id: newId("admisset"), key, value, updatedAt: now });
}

export async function getSystemSetting(
  db: Database,
  key: string,
): Promise<Record<string, unknown> | null> {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  const row = rows[0];
  return row?.value ?? null;
}

export async function updateSystemSetting(
  db: Database,
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  const now = new Date();
  if (existing[0]) {
    await db
      .update(systemSettings)
      .set({ value, updatedAt: now })
      .where(eq(systemSettings.key, key));
    return;
  }
  await db.insert(systemSettings).values({ id: newId("sysset"), key, value, updatedAt: now });
}

export async function recordApiHealthCheck(db: Database, input: {
  target: string;
  method: string;
  status: string;
  responseCode?: number | null;
  latencyMs?: number | null;
  message?: string | null;
}): Promise<void> {
  await db.insert(apiHealthChecks).values({
    id: newId("healthcheck"),
    target: input.target,
    method: input.method,
    status: input.status,
    responseCode: input.responseCode ?? null,
    latencyMs: input.latencyMs ?? null,
    message: input.message ?? null,
  });
}

export async function listApiHealthChecks(db: Database, limit = 50) {
  return db.select().from(apiHealthChecks).orderBy(apiHealthChecks.checkedAt).limit(limit);
}

export async function recordProviderSyncJob(db: Database, input: {
  providerKey: string;
  status: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const rows = await db
    .select()
    .from(providerSyncJobs)
    .where(eq(providerSyncJobs.providerKey, input.providerKey))
    .limit(1);
  const now = new Date();
  if (rows[0]) {
    await db
      .update(providerSyncJobs)
      .set({ status: input.status, finishedAt: now, details: input.details ?? {} })
      .where(eq(providerSyncJobs.id, rows[0].id));
    return;
  }
  await db.insert(providerSyncJobs).values({
    id: newId("syncjob"),
    providerKey: input.providerKey,
    status: input.status,
    startedAt: now,
    finishedAt: now,
    details: input.details ?? {},
  });
}

export async function listProviderSyncJobs(db: Database, limit = 50) {
  return db.select().from(providerSyncJobs).orderBy(providerSyncJobs.startedAt).limit(limit);
}

export async function recordProviderBalanceSnapshot(db: Database, input: {
  providerKey: string;
  balanceMinor: number | null;
  currency?: string;
}): Promise<void> {
  const rows = await db
    .select()
    .from(providerBalanceSnapshots)
    .where(eq(providerBalanceSnapshots.providerKey, input.providerKey))
    .limit(1);
  if (rows[0]) {
    await db
      .update(providerBalanceSnapshots)
      .set({
        balanceMinor: input.balanceMinor,
        currency: input.currency ?? "USD",
        capturedAt: new Date(),
      })
      .where(eq(providerBalanceSnapshots.id, rows[0].id));
    return;
  }
  await db.insert(providerBalanceSnapshots).values({
    id: newId("balancesnap"),
    providerKey: input.providerKey,
    balanceMinor: input.balanceMinor,
    currency: input.currency ?? "USD",
  });
}

export async function listProviderBalanceSnapshots(
  db: Database,
  providerKey?: string,
  limit = 50,
) {
  const rows = await db
    .select()
    .from(providerBalanceSnapshots)
    .orderBy(providerBalanceSnapshots.capturedAt)
    .limit(limit);
  if (providerKey) {
    return rows.filter((row) => row.providerKey === providerKey);
  }
  return rows;
}
