import { desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { invoices, orders } from "@/lib/db/schema";
import { generateInvoiceNumber, newId } from "@/lib/ids";

export type InvoiceRow = typeof invoices.$inferSelect;

export async function getInvoiceByOrderId(
  db: Database,
  orderId: string,
): Promise<InvoiceRow | null> {
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.orderId, orderId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listInvoicesForOrder(
  db: Database,
  orderId: string,
): Promise<InvoiceRow[]> {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.orderId, orderId))
    .orderBy(desc(invoices.issuedAt));
}

export async function createInvoiceForOrder(
  db: Database,
  orderId: string,
): Promise<InvoiceRow> {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) throw new Error("Order not found");

  const existing = await getInvoiceByOrderId(db, orderId);
  if (existing) return existing;

  const invoice = {
    id: newId("invoice"),
    orderId: order.id,
    number: generateInvoiceNumber(),
    status: "issued",
    subtotalMinor: order.subtotalMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    issuedAt: new Date(),
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.insert(invoices).values(invoice);
  return invoice as InvoiceRow;
}
