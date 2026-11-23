"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/guards";
import { getOrderByNumber } from "@/lib/orders";
import {
  addSupportMessage,
  createSupportTicket,
  getSupportTicketForUser,
} from "@/lib/support";
import {
  customerSupportReplySchema,
  customerSupportTicketSchema,
  formString,
  zodMessage,
} from "@/lib/validation";
import { sendTransactionalEmail } from "@/lib/email-notices";
import { supportTicketCreatedEmail } from "@/lib/email-templates";

export type SupportFormState = {
  ok?: boolean;
  error?: string;
  ticketId?: string;
};

export async function createSupportTicketAction(
  _previous: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const parsed = customerSupportTicketSchema.safeParse({
    orderNumber: formString(formData, "orderNumber"),
    category: formString(formData, "category"),
    subject: formString(formData, "subject"),
    message: formString(formData, "message"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const user = await requireUser("/portal/support");
  const db = await getDb();
  let orderId: string | null = null;
  if (parsed.data.orderNumber) {
    const order = await getOrderByNumber(db, parsed.data.orderNumber);
    if (!order || order.userId !== user.id) {
      return { error: "That order is not linked to your account." };
    }
    orderId = order.id;
  }

  const ticket = await createSupportTicket(db, {
    userId: user.id,
    orderId,
    requesterEmail: user.email,
    subject: parsed.data.subject,
    category: parsed.data.category,
    priority: "normal",
    message: parsed.data.message,
  });
  const template = supportTicketCreatedEmail({
    ticketId: ticket.id,
    subject: ticket.subject,
  });
  await sendTransactionalEmail(db, {
    to: user.email,
    subject: template.subject,
    text: template.text,
    template: "support.ticket_created",
    orderId: orderId ?? undefined,
  });
  revalidatePath("/portal/support");
  revalidatePath("/admin/support");
  return { ok: true, ticketId: ticket.id };
}

export async function replySupportTicketAction(
  _previous: SupportFormState,
  formData: FormData,
): Promise<SupportFormState> {
  const parsed = customerSupportReplySchema.safeParse({
    ticketId: formString(formData, "ticketId"),
    message: formString(formData, "message"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const user = await requireUser(`/portal/support/${parsed.data.ticketId}`);
  const db = await getDb();
  const ticket = await getSupportTicketForUser(db, parsed.data.ticketId, user.id);
  if (!ticket) return { error: "Support ticket not found." };
  if (ticket.status === "closed") {
    return { error: "This ticket is closed. Open a new ticket for a new request." };
  }

  await addSupportMessage(db, {
    ticketId: ticket.id,
    authorType: "customer",
    authorId: user.id,
    body: parsed.data.message,
  });
  revalidatePath(`/portal/support/${ticket.id}`);
  revalidatePath("/portal/support");
  revalidatePath("/admin/support");
  return { ok: true };
}
