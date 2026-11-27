import { desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  notifications,
  supportMessages,
  supportTickets,
  users,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";

export type SupportTicketRow = typeof supportTickets.$inferSelect;
export type SupportMessageRow = typeof supportMessages.$inferSelect;

export interface SupportTicketView extends SupportTicketRow {
  messages: SupportMessageRow[];
}

export {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_PRIORITY_LABELS,
} from "@/lib/support-constants";
export type { SupportCategory, SupportStatus, SupportPriority } from "@/lib/support-constants";
import type { SupportCategory, SupportPriority, SupportStatus } from "@/lib/support-constants";
import { SUPPORT_STATUS_LABELS } from "@/lib/support-constants";

export interface CreateSupportTicketInput {
  userId?: string | null;
  orderId?: string | null;
  requesterEmail?: string | null;
  subject: string;
  category?: string;
  priority?: string;
  message: string;
}

export async function createSupportTicket(
  db: Database,
  input: CreateSupportTicketInput,
): Promise<SupportTicketRow> {
  if (!input.subject.trim() || !input.message.trim()) {
    throw new Error("Support tickets require a subject and a message");
  }
  const now = new Date();
  const ticket = {
    id: newId("support"),
    userId: input.userId ?? null,
    orderId: input.orderId ?? null,
    requesterEmail: (input.requesterEmail ?? "").trim().toLowerCase().slice(0, 254),
    subject: input.subject.trim().slice(0, 300),
    category: (input.category ?? "general").slice(0, 40),
    status: "open",
    priority: (input.priority ?? "normal").slice(0, 20),
    assignedTo: null,
    assignedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction(async (tx) => {
    await tx.insert(supportTickets).values(ticket);
    await tx.insert(supportMessages).values({
      id: newId("supportmsg"),
      ticketId: ticket.id,
      authorType: "customer",
      authorId: input.userId ?? null,
      body: input.message.trim(),
      createdAt: now,
    });
    await recordAudit(tx, {
      actorType: input.userId ? "user" : "anonymous",
      actorId: input.userId ?? null,
      action: "support.ticket_created",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: { category: ticket.category, orderId: ticket.orderId },
    });
  });
  return ticket;
}

export async function listSupportTicketsForUser(
  db: Database,
  userId: string,
): Promise<SupportTicketRow[]> {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.updatedAt));
}

export async function listSupportTicketViewsForUser(
  db: Database,
  userId: string,
): Promise<SupportTicketView[]> {
  const tickets = await listSupportTicketsForUser(db, userId);
  return Promise.all(
    tickets.map(async (ticket) => ({
      ...ticket,
      messages: await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, ticket.id))
        .orderBy(supportMessages.createdAt),
    })),
  );
}

export async function getSupportTicket(
  db: Database,
  ticketId: string,
): Promise<SupportTicketView | null> {
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  const ticket = tickets[0];
  if (!ticket) return null;
  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(supportMessages.createdAt);
  return { ...ticket, messages };
}

/**
 * Customers may only read their own ticket. Returning null for a ticket owned
 * by somebody else keeps authorization decisions in one place.
 */
export async function getSupportTicketForUser(
  db: Database,
  ticketId: string,
  userId: string,
): Promise<SupportTicketView | null> {
  const ticket = await getSupportTicket(db, ticketId);
  if (!ticket || ticket.userId !== userId) return null;
  return ticket;
}

function nextStatusForReply(
  current: string,
  authorType: "customer" | "staff",
): SupportStatus {
  if (authorType === "customer") {
    if (current === "resolved" || current === "closed") return "open";
    return "pending_staff";
  }
  if (current === "closed") return "closed";
  return "pending_customer";
}

export async function addSupportMessage(
  db: Database,
  input: {
    ticketId: string;
    authorType: "customer" | "staff";
    authorId?: string | null;
    body: string;
    notifyUserId?: string | null;
  },
): Promise<SupportMessageRow> {
  if (!input.body.trim()) throw new Error("Support messages cannot be empty");
  const now = new Date();
  return db.transaction(async (tx) => {
    const ticketRows = await tx
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, input.ticketId))
      .limit(1);
    const ticket = ticketRows[0];
    if (!ticket) throw new Error("Support ticket not found");
    if (ticket.status === "closed" && input.authorType === "customer") {
      throw new Error("This ticket is closed. Open a new ticket for a new request.");
    }

    const message = {
      id: newId("supportmsg"),
      ticketId: input.ticketId,
      authorType: input.authorType,
      authorId: input.authorId ?? null,
      body: input.body.trim().slice(0, 4000),
      createdAt: now,
    };
    await tx.insert(supportMessages).values(message);

    const status = nextStatusForReply(ticket.status, input.authorType);
    await tx
      .update(supportTickets)
      .set({
        status,
        closedAt: status === "closed" ? ticket.closedAt : null,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, input.ticketId));

    if (input.authorType === "staff" && ticket.userId) {
      await tx.insert(notifications).values({
        id: newId("notification"),
        userId: ticket.userId,
        type: "support.reply",
        title: "Support replied to your ticket",
        body: `A support reply was added to ticket ${ticket.id} (${ticket.subject}).`,
        payload: { ticketId: ticket.id, category: ticket.category },
        read: false,
        createdAt: now,
      });
    }

    await recordAudit(tx, {
      actorType: input.authorType === "staff" ? "admin" : "user",
      actorId: input.authorId ?? null,
      action:
        input.authorType === "staff"
          ? "admin.support.reply"
          : "support.customer_reply",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: { messageId: message.id, status },
    });
    return message;
  });
}

export interface UpdateSupportTicketInput {
  ticketId: string;
  status?: SupportStatus;
  priority?: SupportPriority;
  category?: SupportCategory;
  assignedTo?: string | null;
  actorId?: string | null;
  actorType?: string;
}

export async function updateSupportTicket(
  db: Database,
  input: UpdateSupportTicketInput,
): Promise<SupportTicketRow> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, input.ticketId))
      .limit(1);
    const ticket = rows[0];
    if (!ticket) throw new Error("Support ticket not found");

    const nextStatus = input.status ?? (ticket.status as SupportStatus);
    const updated = await tx
      .update(supportTickets)
      .set({
        status: nextStatus,
        priority: input.priority ?? ticket.priority,
        category: input.category ?? ticket.category,
        assignedTo: input.assignedTo === undefined ? ticket.assignedTo : input.assignedTo,
        assignedAt:
          input.assignedTo === undefined
            ? ticket.assignedAt
            : input.assignedTo
              ? now
              : null,
        closedAt:
          nextStatus === "closed" ? (ticket.closedAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, input.ticketId))
      .returning();
    const row = updated[0];
    if (!row) throw new Error("Support ticket could not be updated");

    await recordAudit(tx, {
      actorType: input.actorType ?? "admin",
      actorId: input.actorId ?? null,
      action: "admin.support.update",
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: {
        previousStatus: ticket.status,
        status: row.status,
        previousPriority: ticket.priority,
        priority: row.priority,
        previousAssignedTo: ticket.assignedTo,
        assignedTo: row.assignedTo,
      },
    });

    if (row.userId && row.status !== ticket.status) {
      await tx.insert(notifications).values({
        id: newId("notification"),
        userId: row.userId,
        type: "support.status",
        title: `Support ticket ${SUPPORT_STATUS_LABELS[row.status as SupportStatus] ?? row.status}`,
        body: `Ticket ${row.id} (${row.subject}) is now ${row.status.replaceAll("_", " ")}.`,
        payload: { ticketId: row.id, status: row.status },
        read: false,
        createdAt: now,
      });
    }
    return row;
  });
}

export async function listSupportTicketsForOrder(db: Database, orderId: string) {
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.orderId, orderId))
    .orderBy(desc(supportTickets.createdAt));
  const withMessages = await Promise.all(
    tickets.map(async (ticket) => ({
      ticket,
      messages: await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, ticket.id))
        .orderBy(supportMessages.createdAt),
    })),
  );
  return withMessages.map((entry) => entry.ticket);
}

export async function listAllSupportTickets(db: Database, limit = 100) {
  const tickets = await db
    .select()
    .from(supportTickets)
    .orderBy(desc(supportTickets.updatedAt))
    .limit(limit);
  return Promise.all(
    tickets.map(async (ticket) => ({
      ...ticket,
      messages: await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, ticket.id))
        .orderBy(supportMessages.createdAt),
    })),
  );
}

export async function listSupportUsers(db: Database, limit = 100) {
  return db.select().from(users).orderBy(users.createdAt).limit(limit);
}

export async function listSupportAgents(db: Database) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.role, ["admin", "super_admin", "support"]))
    .orderBy(users.name);
}
