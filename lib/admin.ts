import { desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  destinations,
  emailEvents,
  fulfillmentJobs,
  orderItems,
  orders,
  payments,
  plans,
  regions,
  users,
} from "@/lib/db/schema";
import { getOrderByNumber, getOrderView, type OrderView } from "@/lib/orders";

export interface AdminStats {
  totalOrders: number;
  paidOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  queuedJobs: number;
  failedJobs: number;
  loggedEmails: number;
  publishedPlans: number;
  demoPlans: number;
  customers: number;
}

export async function getAdminStats(db: Database): Promise<AdminStats> {
  const [orderRows, jobRows, emailRows, planRows, userRows] = await Promise.all([
    db
      .select({
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
      })
      .from(orders),
    db.select({ status: fulfillmentJobs.status }).from(fulfillmentJobs),
    db.select({ status: emailEvents.status }).from(emailEvents),
    db.select({ status: plans.status, isDemo: plans.isDemo }).from(plans),
    db.select({ role: users.role }).from(users),
  ]);

  return {
    totalOrders: orderRows.length,
    paidOrders: orderRows.filter((row) => row.paymentStatus === "paid").length,
    deliveredOrders: orderRows.filter((row) => row.fulfillmentStatus === "delivered").length,
    failedOrders: orderRows.filter(
      (row) => row.status === "failed" || row.fulfillmentStatus === "failed",
    ).length,
    queuedJobs: jobRows.filter((row) => row.status === "queued" || row.status === "provisioning")
      .length,
    failedJobs: jobRows.filter((row) => row.status === "failed").length,
    loggedEmails: emailRows.filter((row) => row.status === "logged").length,
    publishedPlans: planRows.filter((row) => row.status === "published").length,
    demoPlans: planRows.filter((row) => row.isDemo).length,
    customers: userRows.filter((row) => row.role === "customer").length,
  };
}

export async function listAdminOrders(db: Database, limit = 100) {
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function listAdminJobs(db: Database, limit = 100) {
  return db
    .select({
      job: fulfillmentJobs,
      orderNumber: orders.orderNumber,
      orderEmail: orders.email,
      planName: orderItems.planName,
    })
    .from(fulfillmentJobs)
    .innerJoin(orders, eq(fulfillmentJobs.orderId, orders.id))
    .innerJoin(orderItems, eq(fulfillmentJobs.orderItemId, orderItems.id))
    .orderBy(desc(fulfillmentJobs.createdAt))
    .limit(limit);
}

export async function listAdminEmails(db: Database, limit = 100) {
  return db
    .select({
      email: emailEvents,
      orderNumber: orders.orderNumber,
    })
    .from(emailEvents)
    .leftJoin(orders, eq(emailEvents.orderId, orders.id))
    .orderBy(desc(emailEvents.createdAt))
    .limit(limit);
}

export async function listAdminPlans(db: Database, limit = 120) {
  return db
    .select({
      plan: plans,
      destinationName: destinations.name,
      destinationSlug: destinations.slug,
      regionName: regions.name,
    })
    .from(plans)
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .orderBy(desc(plans.updatedAt))
    .limit(limit);
}

export interface AdminOrderDetail {
  view: OrderView;
  payments: Array<typeof payments.$inferSelect>;
  jobs: Array<{
    job: typeof fulfillmentJobs.$inferSelect;
    planName: string;
  }>;
  emails: Array<typeof emailEvents.$inferSelect>;
}

export async function getAdminOrderDetail(
  db: Database,
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const order = await getOrderByNumber(db, orderNumber);
  if (!order) return null;
  const view = await getOrderView(db, order.id);
  if (!view) return null;

  const [paymentRows, jobRows, emailRows] = await Promise.all([
    db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)),
    db
      .select({ job: fulfillmentJobs, planName: orderItems.planName })
      .from(fulfillmentJobs)
      .innerJoin(orderItems, eq(fulfillmentJobs.orderItemId, orderItems.id))
      .where(eq(fulfillmentJobs.orderId, order.id))
      .orderBy(desc(fulfillmentJobs.createdAt)),
    db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.orderId, order.id))
      .orderBy(desc(emailEvents.createdAt)),
  ]);

  return {
    view,
    payments: paymentRows,
    jobs: jobRows,
    emails: emailRows,
  };
}
