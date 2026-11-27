import QRCode from "qrcode";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { esims, fulfillmentJobs } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto";
import type { EncryptedSecret } from "@/lib/db/schema";

/**
 * eSIM release rules: a QR code or activation code is shown only after the
 * supplier has delivered the profile AND fulfillment has confirmed it — the
 * order item's fulfillment job is `delivered`. A stored profile whose job has
 * not finished (for example a validation that is still running or failed) is
 * never displayed. Email is not part of this decision: website delivery never
 * waits for, or depends on, an email being sent.
 */
export async function deliveredOrderItemIds(db: Database, orderItemIds: string[]): Promise<Set<string>> {
  if (orderItemIds.length === 0) return new Set();
  const rows = await db
    .select({ orderItemId: fulfillmentJobs.orderItemId })
    .from(fulfillmentJobs)
    .where(and(inArray(fulfillmentJobs.orderItemId, orderItemIds), eq(fulfillmentJobs.status, "delivered")));
  return new Set(rows.map((row) => row.orderItemId));
}

export async function isOrderItemDelivered(db: Database, orderItemId: string): Promise<boolean> {
  return (await deliveredOrderItemIds(db, [orderItemId])).has(orderItemId);
}

type EsimRow = typeof esims.$inferSelect;

/** Decrypt the activation code and render its QR image (server only). */
export async function buildActivation(esim: EsimRow): Promise<{ lpa: string; qrDataUrl: string }> {
  const encrypted: EncryptedSecret = {
    ciphertext: esim.lpaCiphertext,
    iv: esim.lpaIv,
    tag: esim.lpaTag,
    wrappedDek: esim.dekWrapped,
    dekIv: esim.dekIv,
    dekTag: esim.dekTag,
    keyVersion: esim.keyVersion,
  };
  let lpa: string;
  try {
    lpa = decryptSecret(encrypted);
  } catch {
    // A server configuration problem (wrong key), not a client error.
    throw new Error("Activation data could not be decrypted");
  }
  const qrDataUrl = await QRCode.toDataURL(lpa, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#102a2e", light: "#ffffff" },
  });
  return { lpa, qrDataUrl };
}
