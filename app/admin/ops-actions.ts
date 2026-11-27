"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdmin, requirePermission } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { orderEvents, orders } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { formString } from "@/lib/validation";
import { resendDeliveryEmails } from "@/lib/fulfillment";
import { checkSupplierNow, setLowBalanceThresholdMinor } from "@/lib/supplier-ops";
import { sendTestEmail } from "@/lib/email-ops";

function orderPath(orderNumber: string) {
  return `/admin/orders/${encodeURIComponent(orderNumber)}`;
}

async function orderByNumber(orderNumber: string) {
  const db = await getDb();
  const order = (await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1))[0];
  return { db, order };
}

/** Internal note on an order (visible to staff only, never to the customer). */
export async function addOrderNoteAction(formData: FormData): Promise<void> {
  const orderNumber = formString(formData, "orderNumber");
  const admin = await requirePermission(orderPath(orderNumber), "orders.write");
  const note = formString(formData, "note").trim().slice(0, 2000);
  const { db, order } = await orderByNumber(orderNumber);
  if (!order) redirect("/admin/orders");
  if (!note) redirect(`${orderPath(orderNumber)}?notice=${encodeURIComponent("Write a note first.")}`);
  await db.insert(orderEvents).values({
    id: newId("orderevent"),
    orderId: order.id,
    type: "admin.note",
    message: note,
    metadata: { authorId: admin.id, authorEmail: admin.email },
  });
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "order.note_added",
    entityType: "order",
    entityId: order.id,
    metadata: { orderNumber },
  });
  revalidatePath(orderPath(orderNumber));
  redirect(`${orderPath(orderNumber)}?notice=${encodeURIComponent("Note added.")}`);
}

/** Re-sends the real eSIM delivery email for a delivered order, after confirmation. */
export async function resendDeliveryEmailAction(formData: FormData): Promise<void> {
  const orderNumber = formString(formData, "orderNumber");
  const admin = await requirePermission(orderPath(orderNumber), "orders.write");
  if (formString(formData, "confirm") !== "yes") {
    redirect(`${orderPath(orderNumber)}?notice=${encodeURIComponent("Tick the confirmation box to resend the email.")}`);
  }
  const { db, order } = await orderByNumber(orderNumber);
  if (!order) redirect("/admin/orders");
  const result = await resendDeliveryEmails(db, order.id);
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "order.delivery_email_resent",
    entityType: "order",
    entityId: order.id,
    metadata: { orderNumber, attempted: result.attempted, reason: result.reason ?? null },
  });
  const notice =
    result.attempted > 0
      ? `Delivery email re-sent for ${result.attempted} item(s). Check the Email Center for the provider result.`
      : `Not sent: ${result.reason}`;
  revalidatePath(orderPath(orderNumber));
  redirect(`${orderPath(orderNumber)}?notice=${encodeURIComponent(notice)}`);
}

/** Marks an admin alert as resolved (the alert itself is kept). */
export async function resolveAlertAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/alerts");
  const alertId = formString(formData, "alertId");
  const db = await getDb();
  const alert = (await db.select().from(orderEvents).where(eq(orderEvents.id, alertId)).limit(1))[0];
  if (!alert || alert.type !== "admin.alert") redirect("/admin/alerts");
  await db.insert(orderEvents).values({
    id: newId("orderevent"),
    orderId: alert.orderId,
    type: "admin.alert_resolved",
    message: `Alert resolved by ${admin.email}.`,
    metadata: { alertId, resolvedBy: admin.id },
  });
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "alert.resolved",
    entityType: "order_event",
    entityId: alertId,
  });
  revalidatePath("/admin/alerts");
  redirect("/admin/alerts?notice=resolved");
}

/** Reads the supplier balance now (read-only at eSIM Access). */
export async function checkSupplierAction(): Promise<void> {
  const admin = await requireAdmin("/admin/provider");
  const db = await getDb();
  const result = await checkSupplierNow(db);
  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "supplier.balance_checked",
    entityType: "supplier",
    entityId: "esimaccess",
    metadata: { ok: result.ok, alerts: result.alerts },
  });
  revalidatePath("/admin/provider");
  redirect(`/admin/provider?notice=${encodeURIComponent(result.message)}`);
}

export async function setLowBalanceThresholdAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/provider");
  const raw = formString(formData, "thresholdUsd").trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) {
    redirect(`/admin/provider?notice=${encodeURIComponent("Enter a USD amount such as 25 or 25.50.")}`);
  }
  const db = await getDb();
  await setLowBalanceThresholdMinor(db, Math.round(Number(raw) * 100), admin.id);
  revalidatePath("/admin/provider");
  redirect(`/admin/provider?notice=${encodeURIComponent("Low-balance threshold saved.")}`);
}

/** Sends one test email to an administrator-controlled address, after confirmation. */
export async function sendTestEmailAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/emails");
  const db = await getDb();
  const result = await sendTestEmail(db, {
    adminId: admin.id,
    adminEmail: admin.email,
    recipient: formString(formData, "recipient"),
    template: formString(formData, "template"),
    confirmed: formString(formData, "confirm") === "yes",
  });
  revalidatePath("/admin/emails");
  const query = result.ok
    ? `test=sent&id=${encodeURIComponent(result.providerMessageId)}`
    : `test=failed&error=${encodeURIComponent(result.error.slice(0, 300))}`;
  redirect(`/admin/emails?${query}`);
}
