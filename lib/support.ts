import { desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { supportMessages, supportTickets, users } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export type SupportTicketRow = typeof supportTickets.$inferSelect;
export type SupportMessageRow = typeof supportMessages.$inferSelect;

export interface SupportTicketView extends SupportTicketRow {
  messages: SupportMessageRow[];
}

export interface CreateSupportTicketInput {
  userId?: string | null;
  orderId?: string | null;
  requesterEmail?: string | null;
  subject: string;
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
  const ticket = {
    id: newId("support"),
    userId: input.userId ?? null,
    orderId: input.orderId ?? null,
    requesterEmail: (input.requesterEmail ?? "").trim().toLowerCase().slice(0, 254),
    subject: input.subject.trim().slice(0, 300),
    status: "open",
    priority: input.priority ?? "normal",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(supportTickets).values(ticket);
  await db.insert(supportMessages).values({
    id: newId("supportmsg"),
    ticketId: ticket.id,
    authorType: "customer",
    authorId: input.userId ?? null,
    body: input.message.trim(),
    createdAt: new Date(),
  });
  return ticket;
}

export async function listSupportTicketsForUser(
  db: Database,
  userId: string,
): Promise<SupportTicketRow[]> {
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt));
  const withCounts = await Promise.all(
    tickets.map(async (ticket) => ({
      ticket,
      messages: await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.ticketId, ticket.id))
        .orderBy(supportMessages.createdAt),
    })),
  );
  return withCounts.map((entry) => entry.ticket);
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

export async function addSupportMessage(
  db: Database,
  input: {
    ticketId: string;
    authorType: string;
    authorId?: string | null;
    body: string;
  },
): Promise<SupportMessageRow> {
  if (!input.body.trim()) throw new Error("Support messages cannot be empty");
  const message = {
    id: newId("supportmsg"),
    ticketId: input.ticketId,
    authorType: input.authorType,
    authorId: input.authorId ?? null,
    body: input.body.trim(),
    createdAt: new Date(),
  };
  await db.insert(supportMessages).values(message);
  await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, input.ticketId));
  return message;
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
    .orderBy(desc(supportTickets.createdAt))
    .limit(limit);
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

export async function listSupportUsers(db: Database, limit = 100) {
  return db.select().from(users).orderBy(users.createdAt).limit(limit);
}
