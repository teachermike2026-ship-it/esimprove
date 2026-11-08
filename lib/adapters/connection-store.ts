import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { supplierCapabilities, supplierConnections } from "@/lib/db/schema";
import type { EncryptedSecret } from "@/lib/db/schema";

export type SupplierConnectionRow = typeof supplierConnections.$inferSelect;
export type SupplierCapabilityRow = typeof supplierCapabilities.$inferSelect;

export async function listConnections(): Promise<SupplierConnectionRow[]> {
  const db = await getDb();
  return db.select().from(supplierConnections).orderBy(desc(supplierConnections.updatedAt));
}

export async function getConnection(id: string): Promise<SupplierConnectionRow | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(supplierConnections)
    .where(eq(supplierConnections.id, id))
    .limit(1);
  return rows[0] || undefined;
}

export async function createConnection(input: {
  id: string;
  displayName: string;
  adapterType: string;
  environment: string;
  baseUrl: string;
  authMethod: string;
  credentialEncrypted: EncryptedSecret;
}): Promise<SupplierConnectionRow> {
  const db = await getDb();
  const rows = await db
    .insert(supplierConnections)
    .values({
      id: input.id,
      displayName: input.displayName,
      adapterType: input.adapterType,
      environment: input.environment,
      baseUrl: input.baseUrl,
      authMethod: input.authMethod,
      credentialEncrypted: input.credentialEncrypted,
      enabled: false,
      status: "disconnected",
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Supplier connection could not be stored");
  return row;
}

export async function listCapabilitiesForConnections(
  connectionIds: string[],
): Promise<SupplierCapabilityRow[]> {
  if (connectionIds.length === 0) return [];
  const db = await getDb();
  return db
    .select()
    .from(supplierCapabilities)
    .where(inArray(supplierCapabilities.connectionId, connectionIds))
    .orderBy(supplierCapabilities.capability);
}

export async function updateConnectionStatus(id: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  await db
    .update(supplierConnections)
    .set({
      enabled,
      status: enabled ? "connected" : "disconnected",
      updatedAt: new Date(),
    })
    .where(eq(supplierConnections.id, id));
}

export async function setLastTestSafe(id: string, safeError?: string | null): Promise<void> {
  const db = await getDb();
  await db
    .update(supplierConnections)
    .set({
      lastTestAt: new Date(),
      lastErrorSafe: safeError ?? null,
      status: safeError ? "error" : "untested",
      updatedAt: new Date(),
    })
    .where(eq(supplierConnections.id, id));
}

export async function setLastSync(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(supplierConnections)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(supplierConnections.id, id));
}
