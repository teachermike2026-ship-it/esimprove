import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  activationAccessLogs,
  esims,
  orderAccessTokens,
  orderEvents,
  orderItems,
  orders,
} from "@/lib/db/schema";
import type { OrderStatus, PaymentStatus, FulfillmentStatus } from "@/lib/state";
import { hashToken, randomToken } from "@/lib/crypto";
import { newId } from "@/lib/ids";

export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type EsimRow = typeof esims.$inferSelect;

export interface OrderItemView extends OrderItemRow {
  esimId: string | null;
  esimStatus: string | null;
  esimIccid: string | null;
}

export interface OrderView {
  order: OrderRow;
  items: OrderItemView[];
  events: Array<typeof orderEvents.$inferSelect>;
}

export async function createOrderAccessToken(
  db: Database,
  orderId: string,
  ttlDays = 30,
): Promise<string> {
  const token = randomToken(32);
  await db.insert(orderAccessTokens).values({
    id: newId("access"),
    orderId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  });
  return token;
}

export async function verifyOrderAccessToken(
  db: Database,
  orderId: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  const rows = await db
    .select({ id: orderAccessTokens.id })
    .from(orderAccessTokens)
    .where(
      and(
        eq(orderAccessTokens.orderId, orderId),
        eq(orderAccessTokens.tokenHash, hashToken(token)),
        isNull(orderAccessTokens.revokedAt),
        gt(orderAccessTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function canViewOrder(
  db: Database,
  order: OrderRow,
  viewer: { userId?: string | null; role?: string | null; token?: string | null },
): Promise<boolean> {
  if (viewer.role === "admin") return true;
  if (viewer.userId && order.userId === viewer.userId) return true;
  if (viewer.token) return verifyOrderAccessToken(db, order.id, viewer.token);
  return false;
}

export async function getOrderByNumber(
  db: Database,
  orderNumber: string,
): Promise<OrderRow | null> {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrderById(db: Database, orderId: string): Promise<OrderRow | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderItems(db: Database, orderId: string): Promise<OrderItemView[]> {
  const rows = await db
    .select({
      item: orderItems,
      esimId: esims.id,
      esimStatus: esims.status,
      esimIccid: esims.iccid,
    })
    .from(orderItems)
    .leftJoin(esims, eq(esims.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.createdAt);

  return rows.map((row) => ({
    ...row.item,
    esimId: row.esimId,
    esimStatus: row.esimStatus,
    esimIccid: row.esimIccid,
  }));
}

export async function getOrderEvents(db: Database, orderId: string) {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(desc(orderEvents.createdAt));
}

export async function getOrderView(db: Database, orderId: string): Promise<OrderView | null> {
  const order = await getOrderById(db, orderId);
  if (!order) return null;
  return {
    order,
    items: await getOrderItems(db, orderId),
    events: await getOrderEvents(db, orderId),
  };
}

export async function getOrderViewByNumber(
  db: Database,
  orderNumber: string,
): Promise<OrderView | null> {
  const order = await getOrderByNumber(db, orderNumber);
  if (!order) return null;
  return getOrderView(db, order.id);
}

export async function listOrdersForUser(db: Database, userId: string) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function listAllOrders(db: Database, limit = 100) {
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function getEsimForOrderItem(
  db: Database,
  orderItemId: string,
): Promise<EsimRow | null> {
  const rows = await db
    .select()
    .from(esims)
    .where(eq(esims.orderItemId, orderItemId))
    .limit(1);
  return rows[0] ?? null;
}

export async function logActivationAccess(
  db: Database,
  input: {
    esimId: string;
    orderId: string;
    actorType: string;
    actorId?: string | null;
    ipHash?: string | null;
  },
): Promise<void> {
  await db.insert(activationAccessLogs).values({
    id: newId("accesslog"),
    esimId: input.esimId,
    orderId: input.orderId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    ipHash: input.ipHash ?? null,
  });
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isPaid(status: PaymentStatus): boolean {
  return status === "paid";
}

export function orderStatusLabel(status: string): string {
  const map: Record<OrderStatus, string> = {
    pending_payment: "Awaiting payment",
    processing: "Processing",
    delivered: "Delivered",
    failed: "Needs attention",
    cancelled: "Cancelled",
  };
  return map[status as OrderStatus] ?? statusLabel(status);
}

export function fulfillmentStatusLabel(status: string): string {
  const map: Record<FulfillmentStatus, string> = {
    not_started: "Not started",
    queued: "Queued",
    provisioning: "Provisioning",
    ready: "Ready",
    delivered: "Delivered",
    failed: "Failed",
    under_investigation: "Under investigation",
    cancelled: "Cancelled",
  };
  return map[status as FulfillmentStatus] ?? statusLabel(status);
}
