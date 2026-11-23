"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/guards";
import { getOrderByNumber } from "@/lib/orders";
import { requestRefund } from "@/lib/refunds";
import { parseMoneyToMinor } from "@/lib/money";
import { formString, refundRequestSchema, zodMessage } from "@/lib/validation";
import { sendTransactionalEmail } from "@/lib/email-notices";
import { refundRequestedEmail } from "@/lib/email-templates";

export type RefundRequestState = {
  ok?: boolean;
  error?: string;
};

export async function requestOrderRefundAction(
  _previous: RefundRequestState,
  formData: FormData,
): Promise<RefundRequestState> {
  const parsed = refundRequestSchema.safeParse({
    orderNumber: formString(formData, "orderNumber"),
    amount: formString(formData, "amount"),
    reason: formString(formData, "reason"),
    confirm: formString(formData, "confirm"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const user = await requireUser(`/portal/orders/${parsed.data.orderNumber}`);
  const db = await getDb();
  const order = await getOrderByNumber(db, parsed.data.orderNumber);
  if (!order || order.userId !== user.id) {
    return { error: "Order not found in your account." };
  }

  let amountMinor: number;
  try {
    amountMinor = parseMoneyToMinor(parsed.data.amount, order.currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid amount." };
  }
  if (amountMinor <= 0) {
    return { error: "Enter a refund amount greater than zero." };
  }

  try {
    await requestRefund(db, {
      orderId: order.id,
      amountMinor,
      reason: parsed.data.reason,
      actorType: "customer",
      actorId: user.id,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "The refund request could not be recorded.",
    };
  }

  const template = refundRequestedEmail({
    orderNumber: order.orderNumber,
    amountMinor,
    currency: order.currency,
  });
  await sendTransactionalEmail(db, {
    to: order.email,
    subject: template.subject,
    text: template.text,
    template: "refund.requested",
    orderId: order.id,
  });

  revalidatePath(`/portal/orders/${order.orderNumber}`);
  revalidatePath("/portal");
  revalidatePath("/admin/refunds");
  return { ok: true };
}
