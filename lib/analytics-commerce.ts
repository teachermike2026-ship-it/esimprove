import { and, count, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  auditLogs,
  destinations,
  fulfillmentJobs,
  orderItems,
  orders,
  plans,
  refunds,
  regions,
  supportTickets,
  users,
} from "@/lib/db/schema";

/* ------------------------------------------------------------------ */
/* UTC range handling                                                  */
/* ------------------------------------------------------------------ */

export type CommerceRangeKey = "today" | "7d" | "30d" | "90d" | "all";

export interface CommerceRange {
  key: CommerceRangeKey;
  label: string;
  from: Date | null;
  to: Date;
  bucket: "day" | "month";
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function resolveCommerceRange(input?: string): CommerceRange {
  const now = new Date();
  const today = startOfUtcDay(now);
  const to = new Date(today.getTime() + 86_400_000);
  const day = 86_400_000;
  switch ((input ?? "7d").toLowerCase()) {
    case "today":
      return { key: "today", label: "Today", from: today, to, bucket: "day" };
    case "30d":
      return { key: "30d", label: "Last 30 days", from: new Date(today.getTime() - 29 * day), to, bucket: "day" };
    case "90d":
      return { key: "90d", label: "Last 90 days", from: new Date(today.getTime() - 89 * day), to, bucket: "day" };
    case "all":
      return { key: "all", label: "All time", from: null, to, bucket: "month" };
    case "7d":
    default:
      return { key: "7d", label: "Last 7 days", from: new Date(today.getTime() - 6 * day), to, bucket: "day" };
  }
}

export interface TimePoint {
  bucket: string;
  value: number;
}

function bucketLabel(date: Date, bucket: "day" | "month"): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  if (bucket === "month") return `${y}-${m}`;
  return `${y}-${m}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Zero-fills every bucket between from (or fallbackStart) and to. */
export function zeroFillSeries(
  range: CommerceRange,
  filled: Map<string, number>,
  fallbackStart?: Date | null,
): TimePoint[] {
  const points: TimePoint[] = [];
  if (range.bucket === "day") {
    const from = range.from ?? today();
    for (let d = from.getTime(); d < range.to.getTime(); d += 86_400_000) {
      const date = new Date(d);
      const key = bucketLabel(date, "day");
      points.push({ bucket: key, value: filled.get(key) ?? 0 });
    }
    return points;
  }
  const start = fallbackStart ?? null;
  if (!start) return [];
  const startMonth = startOfUtcMonth(start);
  const endMonth = startOfUtcMonth(new Date(range.to.getTime() - 1));
  for (let d = startMonth.getTime(); d <= endMonth.getTime(); d = new Date(Date.UTC(new Date(d).getUTCFullYear(), new Date(d).getUTCMonth() + 1, 1)).getTime()) {
    const date = new Date(d);
    const key = bucketLabel(date, "month");
    points.push({ bucket: key, value: filled.get(key) ?? 0 });
  }
  return points;
}

function today(): Date {
  return startOfUtcDay(new Date());
}

const BUCKET_SQL: Record<"day" | "month", string> = {
  day: "YYYY-MM-DD",
  month: "YYYY-MM",
};

async function bucketCount(
  db: Database,
  range: CommerceRange,
  table: "orders" | "users",
): Promise<Map<string, number>> {
  const column = table === "orders" ? orders.createdAt : users.createdAt;
  const source = table === "orders" ? orders : users;
  const fmt = BUCKET_SQL[range.bucket];
  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${sql.raw(`'${range.bucket}'`)}, ${column}), ${sql.raw(`'${fmt}'`)})`,
      value: count(),
    })
    .from(source)
    .where(range.from ? gte(column, range.from) : undefined)
    .groupBy(sql`1`);
  return new Map(rows.map((row) => [row.bucket, Number(row.value)]));
}

async function earliestCreated(
  db: Database,
  table: "orders" | "users",
): Promise<Date | null> {
  const column = table === "orders" ? orders.createdAt : users.createdAt;
  const source = table === "orders" ? orders : users;
  const rows = await db.select({ value: sql<Date | null>`min(${column})` }).from(source);
  const value = rows[0]?.value ?? null;
  return value ? new Date(value) : null;
}

/* ------------------------------------------------------------------ */
/* KPI snapshot                                                        */
/* ------------------------------------------------------------------ */

export interface CommerceKpis {
  ordersTotal: number;
  ordersToday: number;
  ordersThisMonth: number;
  customersTotal: number;
  customersNewThisMonth: number;
  publishedPlans: number;
  destinationsTotal: number;
  pendingRefunds: number;
  openSupportTickets: number;
  failedJobs: number;
}

export async function getCommerceKpis(db: Database): Promise<CommerceKpis> {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const [
    total, todayCount, monthCount,
    customerCount, customerMonthCount,
    publishedPlans, destinationsTotal,
    pendingRefunds, openTickets, failedJobs,
  ] = await Promise.all([
    db.select({ value: count() }).from(orders),
    db.select({ value: count() }).from(orders).where(gte(orders.createdAt, todayStart)),
    db.select({ value: count() }).from(orders).where(gte(orders.createdAt, monthStart)),
    db.select({ value: count() }).from(users).where(eq(users.role, "customer")),
    db.select({ value: count() }).from(users).where(and(eq(users.role, "customer"), gte(users.createdAt, monthStart))),
    db.select({ value: count() }).from(plans).where(eq(plans.status, "published")),
    db.select({ value: count() }).from(destinations),
    db.select({ value: count() }).from(refunds).where(eq(refunds.status, "requested")),
    db.select({ value: count() }).from(supportTickets).where(inArray(supportTickets.status, ["open", "pending_staff"])),
    db.select({ value: count() }).from(fulfillmentJobs).where(eq(fulfillmentJobs.status, "failed")),
  ]);
  const num = (rows: Array<{ value: number | string }>) => Number(rows[0]?.value ?? 0);
  return {
    ordersTotal: num(total),
    ordersToday: num(todayCount),
    ordersThisMonth: num(monthCount),
    customersTotal: num(customerCount),
    customersNewThisMonth: num(customerMonthCount),
    publishedPlans: num(publishedPlans),
    destinationsTotal: num(destinationsTotal),
    pendingRefunds: num(pendingRefunds),
    openSupportTickets: num(openTickets),
    failedJobs: num(failedJobs),
  };
}

/* ------------------------------------------------------------------ */
/* Time series                                                         */
/* ------------------------------------------------------------------ */

export async function getOrdersSeries(db: Database, range: CommerceRange): Promise<TimePoint[]> {
  const filled = await bucketCount(db, range, "orders");
  const fallback =
    range.bucket === "month" ? await earliestCreated(db, "orders") : null;
  return zeroFillSeries(range, filled, range.bucket === "month" ? fallback : range.from);
}

export async function getRegistrationsSeries(db: Database, range: CommerceRange): Promise<TimePoint[]> {
  const bucket = range.bucket;
  const column = users.createdAt;
  const fmt = BUCKET_SQL[bucket];
  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${sql.raw(`'${bucket}'`)}, ${column}), ${sql.raw(`'${fmt}'`)})`,
      value: count(),
    })
    .from(users)
    .where(and(eq(users.role, "customer"), range.from ? gte(column, range.from) : undefined))
    .groupBy(sql`1`);
  const filled = new Map(rows.map((row) => [row.bucket, Number(row.value)]));
  const fallback =
    bucket === "month" ? await earliestCreated(db, "users") : null;
  return zeroFillSeries(range, filled, bucket === "month" ? fallback : range.from);
}

export interface DemoOrderValue {
  byCurrency: Array<{ currency: string; totalMinor: number }>;
  primaryCurrency: string | null;
  series: TimePoint[];
  totalMinor: number;
}

/** DEMO-labelled order value: SUM(total_minor) of paid mock orders. */
export async function getDemoOrderValue(db: Database, range: CommerceRange): Promise<DemoOrderValue> {
  const where = range.from
    ? and(eq(orders.paymentStatus, "paid"), gte(orders.createdAt, range.from))
    : eq(orders.paymentStatus, "paid");
  const currencyRows = await db
    .select({
      currency: orders.currency,
      total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
      count: count(),
    })
    .from(orders)
    .where(where)
    .groupBy(orders.currency)
    .orderBy(desc(count()));
  const byCurrency = currencyRows.map((row) => ({
    currency: row.currency,
    totalMinor: Number(row.total),
  }));
  const primary = byCurrency[0]?.currency ?? null;
  const totalMinor = byCurrency.reduce((sum, row) => sum + row.totalMinor, 0);

  let series: TimePoint[] = [];
  if (primary) {
    const bucket = range.bucket;
    const fmt = BUCKET_SQL[bucket];
    const rows = await db
      .select({
        bucket: sql<string>`to_char(date_trunc(${sql.raw(`'${bucket}'`)}, ${orders.createdAt}), ${sql.raw(`'${fmt}'`)})`,
        value: sql<number>`coalesce(sum(${orders.totalMinor}), 0)`,
      })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "paid"), eq(orders.currency, primary), range.from ? gte(orders.createdAt, range.from) : undefined))
      .groupBy(sql`1`);
    const filled = new Map(rows.map((row) => [row.bucket, Number(row.value)]));
    const fallback = bucket === "month" ? await earliestCreated(db, "orders") : null;
    series = zeroFillSeries(range, filled, bucket === "month" ? fallback : range.from);
  } else {
    series = zeroFillSeries(range, new Map(), range.from ?? null);
  }

  return { byCurrency, primaryCurrency: primary, series, totalMinor };
}

/* ------------------------------------------------------------------ */
/* Orders by status                                                    */
/* ------------------------------------------------------------------ */

export interface StatusCount {
  status: string;
  count: number;
}

export async function getOrdersByPaymentStatus(db: Database, range: CommerceRange): Promise<StatusCount[]> {
  const rows = await db
    .select({ status: orders.paymentStatus, count: count() })
    .from(orders)
    .where(range.from ? gte(orders.createdAt, range.from) : undefined)
    .groupBy(orders.paymentStatus)
    .orderBy(desc(count()));
  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}

export async function getOrdersByFulfillmentStatus(db: Database, range: CommerceRange): Promise<StatusCount[]> {
  const rows = await db
    .select({ status: orders.fulfillmentStatus, count: count() })
    .from(orders)
    .where(range.from ? gte(orders.createdAt, range.from) : undefined)
    .groupBy(orders.fulfillmentStatus)
    .orderBy(desc(count()));
  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}

/* ------------------------------------------------------------------ */
/* Top plans / destinations by order items                             */
/* ------------------------------------------------------------------ */

export interface TopEntry {
  id: string;
  label: string;
  quantity: number;
  hint?: string;
}

export async function getTopPlansByOrders(db: Database, range: CommerceRange, limit = 10): Promise<TopEntry[]> {
  const rows = await db
    .select({
      planId: orderItems.planId,
      planName: orderItems.planName,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(range.from ? gte(orders.createdAt, range.from) : undefined)
    .groupBy(orderItems.planId, orderItems.planName)
    .orderBy(desc(sql`coalesce(sum(${orderItems.quantity}), 0)`))
    .limit(limit);
  return rows.map((row) => ({
    id: row.planId,
    label: row.planName,
    quantity: Number(row.quantity),
  }));
}

export async function getTopDestinationsByOrders(db: Database, range: CommerceRange, limit = 10): Promise<TopEntry[]> {
  const rows = await db
    .select({
      destinationId: destinations.id,
      destinationName: destinations.name,
      regionName: regions.name,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(plans, eq(orderItems.planId, plans.id))
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .innerJoin(regions, eq(destinations.regionId, regions.id))
    .where(range.from ? gte(orders.createdAt, range.from) : undefined)
    .groupBy(destinations.id, destinations.name, regions.name)
    .orderBy(desc(sql`coalesce(sum(${orderItems.quantity}), 0)`))
    .limit(limit);
  return rows.map((row) => ({
    id: row.destinationId,
    label: row.destinationName,
    quantity: Number(row.quantity),
    hint: row.regionName,
  }));
}

/* ------------------------------------------------------------------ */
/* Catalogue analytics                                                 */
/* ------------------------------------------------------------------ */

export interface CatalogueAnalytics {
  plansByStatus: { published: number; draft: number; archived: number; other: number };
  zeroOrderPlans: number;
  zeroOrderPlanList: Array<{ id: string; name: string; destinationName: string }>;
  recentChanges: Array<{ id: string; action: string; entityType: string; createdAt: Date; actorId: string | null }>;
}

const CATALOGUE_ACTIONS = [
  "admin.plan.create", "admin.plan.update", "admin.plan.delete",
  "admin.destination.create", "admin.destination.update", "admin.destination.delete",
  "admin.region.create", "admin.region.update", "admin.region.delete",
] as const;

export async function getCatalogueAnalytics(db: Database): Promise<CatalogueAnalytics> {
  const [statusRows, zeroRows, changeRows] = await Promise.all([
    db.select({ status: plans.status, value: count() }).from(plans).groupBy(plans.status),
    db
      .select({
        id: plans.id,
        name: plans.name,
        destinationName: destinations.name,
      })
      .from(plans)
      .innerJoin(destinations, eq(plans.destinationId, destinations.id))
      .leftJoin(orderItems, eq(orderItems.planId, plans.id))
      .where(eq(plans.status, "published"))
      .groupBy(plans.id, plans.name, destinations.name)
      .having(sql`count(${orderItems.id}) = 0`)
      .orderBy(desc(plans.updatedAt))
      .limit(10),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
        actorId: auditLogs.actorId,
      })
      .from(auditLogs)
      .where(inArray(auditLogs.action, [...CATALOGUE_ACTIONS]))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);

  const plansByStatus = { published: 0, draft: 0, archived: 0, other: 0 };
  for (const row of statusRows) {
    if (row.status === "published") plansByStatus.published = Number(row.value);
    else if (row.status === "draft") plansByStatus.draft = Number(row.value);
    else if (row.status === "archived") plansByStatus.archived = Number(row.value);
    else plansByStatus.other += Number(row.value);
  }

  const zeroCountRows = await db
    .select({ value: count() })
    .from(plans)
    .leftJoin(orderItems, eq(orderItems.planId, plans.id))
    .where(eq(plans.status, "published"))
    .groupBy(plans.id)
    .having(sql`count(${orderItems.id}) = 0`);

  return {
    plansByStatus,
    zeroOrderPlans: zeroCountRows.length,
    zeroOrderPlanList: zeroRows,
    recentChanges: changeRows,
  };
}

/* ------------------------------------------------------------------ */
/* Recent activity feed                                                */
/* ------------------------------------------------------------------ */

export type ActivityKind = "order" | "registration" | "refund" | "ticket" | "catalogue" | "job";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: Date;
  href: string | null;
}

const CATALOGUE_FEED_ACTIONS = [...CATALOGUE_ACTIONS];

export async function getRecentActivity(
  db: Database,
  limit = 12,
  opts: Partial<Record<ActivityKind, boolean>> = {},
): Promise<ActivityItem[]> {
  const active = (kind: ActivityKind) => opts[kind] !== false;
  const perKind = 10;
  const feed: ActivityItem[] = [];

  if (active("order")) {
    const rows = await db
      .select({ id: orders.id, orderNumber: orders.orderNumber, totalMinor: orders.totalMinor, currency: orders.currency, paymentStatus: orders.paymentStatus, createdAt: orders.createdAt })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(perKind);
    for (const row of rows) {
      feed.push({
        id: `order:${row.id}`,
        kind: "order",
        title: `Order ${row.orderNumber}`,
        detail: `Mock payment ${row.paymentStatus}`,
        at: row.createdAt,
        href: `/admin/orders/${row.orderNumber}`,
      });
    }
  }
  if (active("registration")) {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.role, "customer"))
      .orderBy(desc(users.createdAt))
      .limit(perKind);
    for (const row of rows) {
      feed.push({
        id: `user:${row.id}`,
        kind: "registration",
        title: `New customer: ${row.name}`,
        detail: row.email,
        at: row.createdAt,
        href: `/admin/customers/${row.id}`,
      });
    }
  }
  if (active("refund")) {
    const rows = await db
      .select({ id: refunds.id, status: refunds.status, amountMinor: refunds.amountMinor, currency: refunds.currency, createdAt: refunds.createdAt, orderNumber: orders.orderNumber })
      .from(refunds)
      .innerJoin(orders, eq(refunds.orderId, orders.id))
      .orderBy(desc(refunds.createdAt))
      .limit(perKind);
    for (const row of rows) {
      feed.push({
        id: `refund:${row.id}`,
        kind: "refund",
        title: `Refund ${row.status} — ${row.orderNumber}`,
        detail: "Mock refund workflow",
        at: row.createdAt,
        href: "/admin/refunds",
      });
    }
  }
  if (active("ticket")) {
    const rows = await db
      .select({ id: supportTickets.id, subject: supportTickets.subject, status: supportTickets.status, createdAt: supportTickets.createdAt })
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt))
      .limit(perKind);
    for (const row of rows) {
      feed.push({
        id: `ticket:${row.id}`,
        kind: "ticket",
        title: `Support ticket: ${row.subject}`,
        detail: `Status ${row.status}`,
        at: row.createdAt,
        href: "/admin/support",
      });
    }
  }
  if (active("catalogue")) {
    const rows = await db
      .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(inArray(auditLogs.action, CATALOGUE_FEED_ACTIONS))
      .orderBy(desc(auditLogs.createdAt))
      .limit(perKind);
    for (const row of rows) {
      feed.push({
        id: `catalogue:${row.id}`,
        kind: "catalogue",
        title: `Catalogue: ${row.action.replace(/^admin\./, "")}`,
        detail: row.entityType,
        at: row.createdAt,
        href: "/admin/plans",
      });
    }
  }
  if (active("job")) {
    const rows = await db
      .select({ id: fulfillmentJobs.id, status: fulfillmentJobs.status, attempts: fulfillmentJobs.attempts, maxAttempts: fulfillmentJobs.maxAttempts, createdAt: fulfillmentJobs.createdAt, orderNumber: orders.orderNumber })
      .from(fulfillmentJobs)
      .innerJoin(orders, eq(fulfillmentJobs.orderId, orders.id))
      .where(eq(fulfillmentJobs.status, "failed"))
      .orderBy(desc(fulfillmentJobs.createdAt))
      .limit(perKind);
    for (const row of rows) {
      feed.push({
        id: `job:${row.id}`,
        kind: "job",
        title: `Fulfillment failed — ${row.orderNumber}`,
        detail: `${row.attempts}/${row.maxAttempts} attempts`,
        at: row.createdAt,
        href: "/admin/jobs",
      });
    }
  }

  feed.sort((a, b) => b.at.getTime() - a.at.getTime());
  return feed.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  orders: number;
  paidValueMinor: number;
  currency: string;
}

export interface CustomerListResult {
  items: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function listCustomers(
  db: Database,
  opts: { q?: string; page?: number; pageSize?: number } = {},
): Promise<CustomerListResult> {
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 20, 50));
  const page = Math.max(1, opts.page ?? 1);
  const q = (opts.q ?? "").trim();
  const like = `%${escapeLikePattern(q)}%`;
  const where = q
    ? and(eq(users.role, "customer"), or(ilike(users.name, like), ilike(users.email, like)))
    : eq(users.role, "customer");

  const [countRows, pageRows] = await Promise.all([
    db.select({ value: count() }).from(users).where(where),
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, emailVerifiedAt: users.emailVerifiedAt, createdAt: users.createdAt })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const total = Number(countRows[0]?.value ?? 0);
  const ids = pageRows.map((row) => row.id);

  const stats = new Map<string, { orders: number; paidValueMinor: number; currency: string }>();
  if (ids.length > 0) {
    const rows = await db
      .select({
        userId: orders.userId,
        orders: count(),
        paid: sql<number>`coalesce(sum(case when ${orders.paymentStatus} = 'paid' then ${orders.totalMinor} else 0 end), 0)`,
        currency: sql<string>`max(${orders.currency})`,
      })
      .from(orders)
      .where(inArray(orders.userId, ids))
      .groupBy(orders.userId);
    for (const row of rows) {
      if (!row.userId) continue;
      stats.set(row.userId, {
        orders: Number(row.orders),
        paidValueMinor: Number(row.paid),
        currency: row.currency ?? "USD",
      });
    }
  }

  const items = pageRows.map((row) => ({
    ...row,
    orders: stats.get(row.id)?.orders ?? 0,
    paidValueMinor: stats.get(row.id)?.paidValueMinor ?? 0,
    currency: stats.get(row.id)?.currency ?? "USD",
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface CustomerDetail {
  user: typeof users.$inferSelect;
  orders: Array<typeof orders.$inferSelect>;
  stats: { orders: number; paidValueMinor: number; currency: string };
}

export async function getCustomerDetail(db: Database, userId: string): Promise<CustomerDetail | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) return null;
  const history = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(100);
  const paid = history.filter((order) => order.paymentStatus === "paid");
  const paidValueMinor = paid.reduce((sum, order) => sum + order.totalMinor, 0);
  const currency = paid[0]?.currency ?? history[0]?.currency ?? "USD";
  return {
    user,
    orders: history,
    stats: { orders: history.length, paidValueMinor, currency },
  };
}
