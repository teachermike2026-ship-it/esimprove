import type { Database } from "@/lib/db/client";
import { orderEvents } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { sendTransactionalEmail } from "@/lib/email-notices";

/**
 * Operational alerts for situations a person must handle: a paid order whose
 * eSIM could not be issued, a dispute, or a payment held for review.
 *
 * Every alert is written to the order timeline (visible in admin). It is also
 * emailed to ADMIN_ALERT_EMAIL (falling back to SUPPORT_EMAIL) through the
 * configured email transport; in local and sandbox setups that transport is
 * the mock logger, so nothing leaves the machine. Alerts contain order
 * references only: no card data, secrets, or eSIM activation details.
 */
export type AdminAlertKind =
  | "fulfillment.needs_attention"
  | "payment.disputed"
  | "payment.refunded"
  | "payment.review_required";

export function adminAlertRecipient(): string | null {
  const value = (process.env.ADMIN_ALERT_EMAIL ?? process.env.SUPPORT_EMAIL ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export async function alertAdmin(
  db: Database,
  input: { kind: AdminAlertKind; orderId: string; orderNumber?: string | null; summary: string },
): Promise<void> {
  await db.insert(orderEvents).values({
    id: newId("orderevent"),
    orderId: input.orderId,
    type: "admin.alert",
    message: input.summary,
    metadata: { kind: input.kind },
  });

  const to = adminAlertRecipient();
  if (!to) {
    console.warn(`[admin alert] ${input.kind} for order ${input.orderNumber ?? input.orderId} (no ADMIN_ALERT_EMAIL set)`);
    return;
  }
  try {
    await sendTransactionalEmail(db, {
      to,
      subject: `[Action needed] ${input.kind} · order ${input.orderNumber ?? input.orderId}`,
      text: [
        input.summary,
        "",
        `Order: ${input.orderNumber ?? input.orderId}`,
        `Alert: ${input.kind}`,
        "",
        "Open the order in the admin dashboard to review it.",
      ].join("\n"),
      template: "admin.alert",
      orderId: input.orderId,
    });
  } catch (error) {
    // The timeline entry above is the durable record; email is best effort.
    console.error("Admin alert email failed", error instanceof Error ? error.name : "unknown error");
  }
}
