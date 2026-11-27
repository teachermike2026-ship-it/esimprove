/**
 * Operations data for the admin console: the Needs Attention queue, order
 * search, overview figures, supplier status and revenue reporting.
 *
 * Every number comes from database records. Nothing is invented: when a value
 * is unavailable (for example the supplier balance has never been read) it is
 * returned as null and shown as unavailable. Estimates (payment fees, profit)
 * are labelled as such by the callers.
 */
import { and, desc, eq, gte, inArray, isNotNull, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  cryptoPayments,
  destinations,
  emailEvents,
  esims,
  fulfillmentJobs,
  orderEvents,
  orderItems,
  orders,
  paymentProviderCases,
  payments,
  plans,
  providerBalanceSnapshots,
} from "@/lib/db/schema";
import { pricingPolicy } from "@/lib/pricing-config";

const MINUTE = 60_000;
/** A paid order is "waiting too long" after this many minutes without delivery. */
export const PAID_UNDELIVERED_ALERT_MINUTES = 15;
/** A fulfillment job in processing/provisioning longer than this is "stuck". */
export const STUCK_JOB_MINUTES = 15;

// ---------------------------------------------------------------------------
// Needs Attention

export type AttentionKind =
  | "fulfillment_failed"
  | "paid_not_delivered"
  | "delivered_without_esim"
  | "job_stuck"
  | "payment_status_mismatch"
  | "case_needs_review"
  | "crypto_needs_review"
  | "crypto_confirming_long"
  | "disputed";

export interface AttentionItem {
  kind: AttentionKind;
  severity: "critical" | "high" | "medium";
  orderId: string | null;
  orderNumber: string | null;
  reference: string | null;
  summary: string;
  since: Date;
  ageMinutes: number;
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2 } as const;

export async function getNeedsAttention(db: Database, now = new Date()): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];
  const age = (since: Date) => Math.max(0, Math.round((now.getTime() - since.getTime()) / MINUTE));
  const push = (item: Omit<AttentionItem, "ageMinutes">) => items.push({ ...item, ageMinutes: age(item.since) });

  // 1. Paid orders that are not delivered (failed/review, or simply too slow).
  const paidOpen = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      fulfillmentStatus: orders.fulfillmentStatus,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), notInArray(orders.fulfillmentStatus, ["delivered", "cancelled"])));
  for (const row of paidOpen) {
    const since = row.paidAt ?? row.createdAt;
    if (["failed", "manual_review", "under_investigation"].includes(row.fulfillmentStatus)) {
      push({
        kind: "fulfillment_failed",
        severity: "critical",
        orderId: row.id,
        orderNumber: row.orderNumber,
        reference: null,
        summary: `Paid, but supplier fulfillment is "${row.fulfillmentStatus}". The customer has no eSIM.`,
        since,
      });
    } else if (now.getTime() - since.getTime() > PAID_UNDELIVERED_ALERT_MINUTES * MINUTE) {
      push({
        kind: "paid_not_delivered",
        severity: "high",
        orderId: row.id,
        orderNumber: row.orderNumber,
        reference: null,
        summary: `Paid but not delivered yet (fulfillment "${row.fulfillmentStatus}").`,
        since,
      });
    }
  }

  // 2. Orders marked delivered that have no eSIM record at all.
  const deliveredNoEsim = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, updatedAt: orders.updatedAt })
    .from(orders)
    .where(
      and(
        eq(orders.fulfillmentStatus, "delivered"),
        sql`not exists (select 1 from ${orderItems} oi join ${esims} e on e.order_item_id = oi.id where oi.order_id = ${orders.id})`,
      ),
    );
  for (const row of deliveredNoEsim) {
    push({
      kind: "delivered_without_esim",
      severity: "critical",
      orderId: row.id,
      orderNumber: row.orderNumber,
      reference: null,
      summary: "Marked delivered, but no eSIM details are stored for this order.",
      since: row.updatedAt,
    });
  }

  // 3. Fulfillment jobs stuck in processing.
  const stuckBefore = new Date(now.getTime() - STUCK_JOB_MINUTES * MINUTE);
  const stuck = await db
    .select({
      jobId: fulfillmentJobs.id,
      status: fulfillmentJobs.status,
      updatedAt: fulfillmentJobs.updatedAt,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
    })
    .from(fulfillmentJobs)
    .innerJoin(orders, eq(orders.id, fulfillmentJobs.orderId))
    .where(and(inArray(fulfillmentJobs.status, ["processing", "provisioning"]), lt(fulfillmentJobs.updatedAt, stuckBefore)));
  for (const row of stuck) {
    push({
      kind: "job_stuck",
      severity: "high",
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      reference: row.jobId,
      summary: `Fulfillment job has been "${row.status}" for a long time.`,
      since: row.updatedAt,
    });
  }

  // 4. A payment recorded as paid while its order is not paid (or the reverse).
  const mismatch = await db
    .select({
      paymentId: payments.id,
      provider: payments.provider,
      paymentStatus: payments.status,
      orderPaymentStatus: orders.paymentStatus,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.status, "paid"), notInArray(orders.paymentStatus, ["paid", "refunded", "partially_refunded", "disputed"])));
  for (const row of mismatch) {
    push({
      kind: "payment_status_mismatch",
      severity: "critical",
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      reference: row.paymentId,
      summary: `${row.provider} payment is "paid" but the order shows "${row.orderPaymentStatus}".`,
      since: row.updatedAt,
    });
  }

  // 5. Refund/dispute cases held for manual review.
  const cases = await db
    .select({
      caseId: paymentProviderCases.providerCaseId,
      kind: paymentProviderCases.kind,
      reason: paymentProviderCases.reviewReason,
      updatedAt: paymentProviderCases.updatedAt,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
    })
    .from(paymentProviderCases)
    .leftJoin(orders, eq(orders.id, paymentProviderCases.orderId))
    .where(eq(paymentProviderCases.needsReview, true));
  for (const row of cases) {
    push({
      kind: "case_needs_review",
      severity: "high",
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      reference: row.caseId,
      summary: `Whop ${row.kind} needs manual review: ${row.reason ?? "no reason recorded"}.`,
      since: row.updatedAt,
    });
  }

  // 6. USDT payments needing a person, or confirming for over an hour.
  const crypto = await db
    .select({
      id: cryptoPayments.id,
      status: cryptoPayments.status,
      lastError: cryptoPayments.lastError,
      detectedAt: cryptoPayments.detectedAt,
      updatedAt: cryptoPayments.updatedAt,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
    })
    .from(cryptoPayments)
    .innerJoin(orders, eq(orders.id, cryptoPayments.orderId))
    .where(inArray(cryptoPayments.status, ["manual_review", "late_payment", "confirming"]));
  for (const row of crypto) {
    if (row.status === "confirming") {
      const since = row.detectedAt ?? row.updatedAt;
      if (now.getTime() - since.getTime() < 60 * MINUTE) continue;
      push({
        kind: "crypto_confirming_long",
        severity: "medium",
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        reference: row.id,
        summary: "USDT transfer detected but still confirming after an hour.",
        since,
      });
    } else {
      push({
        kind: "crypto_needs_review",
        severity: "high",
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        reference: row.id,
        summary: `USDT payment is "${row.status}"${row.lastError ? `: ${row.lastError.slice(0, 160)}` : ""}.`,
        since: row.updatedAt,
      });
    }
  }

  // 7. Disputed payments.
  const disputed = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, updatedAt: orders.updatedAt })
    .from(orders)
    .where(eq(orders.paymentStatus, "disputed"));
  for (const row of disputed) {
    push({
      kind: "disputed",
      severity: "high",
      orderId: row.id,
      orderNumber: row.orderNumber,
      reference: null,
      summary: "Payment is disputed. Respond in the Whop dashboard.",
      since: row.updatedAt,
    });
  }

  return items.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.ageMinutes - a.ageMinutes,
  );
}

// ---------------------------------------------------------------------------
// Orders list (search, filters, paging)

export const ORDER_PAGE_SIZE = 25;

export interface OrderListFilters {
  q?: string;
  payment?: string;
  fulfillment?: string;
  method?: "card" | "crypto" | "";
  from?: Date | null;
  to?: Date | null;
  page?: number;
}

export async function listOrdersFiltered(db: Database, filters: OrderListFilters) {
  const conditions: SQL[] = [];
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(
      or(
        sql`lower(${orders.orderNumber}) like ${like}`,
        sql`lower(${orders.email}) like ${like}`,
        sql`lower(${orders.customerName}) like ${like}`,
        sql`lower(${orders.id}) like ${like}`,
      )!,
    );
  }
  if (filters.payment) conditions.push(eq(orders.paymentStatus, filters.payment));
  if (filters.fulfillment) conditions.push(eq(orders.fulfillmentStatus, filters.fulfillment));
  if (filters.from) conditions.push(gte(orders.createdAt, filters.from));
  if (filters.to) conditions.push(lt(orders.createdAt, filters.to));
  if (filters.method === "crypto") {
    conditions.push(sql`exists (select 1 from ${payments} p where p.order_id = ${orders.id} and p.provider = 'crypto')`);
  } else if (filters.method === "card") {
    conditions.push(sql`exists (select 1 from ${payments} p where p.order_id = ${orders.id} and p.provider <> 'crypto')`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const page = Math.max(1, filters.page ?? 1);

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(ORDER_PAGE_SIZE)
      .offset((page - 1) * ORDER_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);
  const ids = rows.map((row) => row.id);
  const methods = ids.length
    ? await db
        .select({ orderId: payments.orderId, provider: payments.provider })
        .from(payments)
        .where(inArray(payments.orderId, ids))
    : [];
  const methodByOrder = new Map<string, string>();
  for (const m of methods) {
    methodByOrder.set(m.orderId, methodByOrder.has(m.orderId) ? `${methodByOrder.get(m.orderId)}+${m.provider}` : m.provider);
  }
  return {
    rows: rows.map((row) => ({ ...row, paymentMethods: methodByOrder.get(row.id) ?? "none" })),
    total: Number(total[0]?.n ?? 0),
    page,
    pageSize: ORDER_PAGE_SIZE,
  };
}

/** Counts per payment and fulfillment status (all time). */
export async function orderStatusCounts(db: Database) {
  const [payment, fulfillment] = await Promise.all([
    db.select({ status: orders.paymentStatus, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.paymentStatus),
    db
      .select({ status: orders.fulfillmentStatus, n: sql<number>`count(*)::int` })
      .from(orders)
      .groupBy(orders.fulfillmentStatus),
  ]);
  return {
    payment: Object.fromEntries(payment.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
    fulfillment: Object.fromEntries(fulfillment.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
  };
}

// ---------------------------------------------------------------------------
// Revenue

export interface RevenueReport {
  from: Date;
  to: Date;
  currency: string;
  orders: number;
  grossMinor: number;
  confirmedRefundsMinor: number;
  netSalesMinor: number;
  supplierCostMinor: number;
  /** Estimate from the configured card fee policy; USDT has no processor fee. */
  estimatedPaymentFeesMinor: number;
  /** Net sales minus supplier cost minus estimated fees. */
  estimatedProfitMinor: number;
  averageOrderMinor: number;
  byDay: Array<{ day: string; grossMinor: number; orders: number; estimatedProfitMinor: number }>;
  byMethod: Array<{ method: string; orders: number; grossMinor: number }>;
  byDestination: Array<{ name: string; orders: number; grossMinor: number }>;
  topPlans: Array<{ name: string; quantity: number; grossMinor: number }>;
  /** Paid orders in other currencies are counted here and excluded from the USD totals. */
  otherCurrencyOrders: number;
}

const EVER_PAID = ["paid", "partially_refunded", "refunded", "disputed"];

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getRevenueReport(db: Database, from: Date, to: Date, currency = "USD"): Promise<RevenueReport> {
  const paidOrders = await db
    .select({
      id: orders.id,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      paidAt: orders.paidAt,
      fulfillmentStatus: orders.fulfillmentStatus,
    })
    .from(orders)
    .where(and(inArray(orders.paymentStatus, EVER_PAID), isNotNull(orders.paidAt), gte(orders.paidAt, from), lt(orders.paidAt, to)));

  const inCurrency = paidOrders.filter((o) => o.currency.toUpperCase() === currency);
  const otherCurrencyOrders = paidOrders.length - inCurrency.length;
  const ids = inCurrency.map((o) => o.id);
  const policy = pricingPolicy();

  const [items, methods, refundCases, localRefunds] = ids.length
    ? await Promise.all([
        db
          .select({
            orderId: orderItems.orderId,
            planName: orderItems.planName,
            quantity: orderItems.quantity,
            totalMinor: orderItems.totalMinor,
            costMinor: orderItems.costMinor,
            destination: destinations.name,
          })
          .from(orderItems)
          .leftJoin(plans, eq(plans.id, orderItems.planId))
          .leftJoin(destinations, eq(destinations.id, plans.destinationId))
          .where(inArray(orderItems.orderId, ids)),
        db
          .select({ orderId: payments.orderId, provider: payments.provider })
          .from(payments)
          .where(and(inArray(payments.orderId, ids), eq(payments.status, "paid"))),
        db
          .select({ orderId: paymentProviderCases.orderId, amountMinor: paymentProviderCases.amountMinor })
          .from(paymentProviderCases)
          .where(
            and(
              inArray(paymentProviderCases.orderId, ids),
              eq(paymentProviderCases.kind, "refund"),
              eq(paymentProviderCases.providerStatus, "succeeded"),
              eq(paymentProviderCases.needsReview, false),
            ),
          ),
        db
          .select({ orderId: sql<string>`order_id`, amountMinor: sql<number>`amount_minor` })
          .from(sql`refunds`)
          .where(sql`order_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) and status = 'approved'`),
      ])
    : [[], [], [], []];

  // Refunds per order are capped at the order total (provider-settled amounts
  // can exceed it through exchange rates; see refund reconciliation).
  const refundByOrder = new Map<string, number>();
  for (const r of [...refundCases, ...localRefunds]) {
    if (!r.orderId) continue;
    refundByOrder.set(r.orderId, (refundByOrder.get(r.orderId) ?? 0) + Number(r.amountMinor ?? 0));
  }
  const methodByOrder = new Map<string, string>();
  for (const m of methods) methodByOrder.set(m.orderId, m.provider === "crypto" ? "USDT (crypto)" : m.provider === "whop" ? "Card (Whop)" : m.provider);

  const delivered = new Set(inCurrency.filter((o) => o.fulfillmentStatus === "delivered").map((o) => o.id));
  const costByOrder = new Map<string, number>();
  const byDestination = new Map<string, { orders: Set<string>; grossMinor: number }>();
  const byPlan = new Map<string, { quantity: number; grossMinor: number }>();
  for (const item of items) {
    // Supplier cost is incurred only when the eSIM was actually issued.
    if (delivered.has(item.orderId)) costByOrder.set(item.orderId, (costByOrder.get(item.orderId) ?? 0) + item.costMinor);
    const dest = item.destination ?? "Unknown";
    const d = byDestination.get(dest) ?? { orders: new Set<string>(), grossMinor: 0 };
    d.orders.add(item.orderId);
    d.grossMinor += item.totalMinor;
    byDestination.set(dest, d);
    const p = byPlan.get(item.planName) ?? { quantity: 0, grossMinor: 0 };
    p.quantity += item.quantity;
    p.grossMinor += item.totalMinor;
    byPlan.set(item.planName, p);
  }

  let gross = 0;
  let refunds = 0;
  let cost = 0;
  let fees = 0;
  const days = new Map<string, { grossMinor: number; orders: number; estimatedProfitMinor: number }>();
  const byMethod = new Map<string, { orders: number; grossMinor: number }>();
  for (const order of inCurrency) {
    const refund = Math.min(refundByOrder.get(order.id) ?? 0, order.totalMinor);
    const method = methodByOrder.get(order.id) ?? "Unknown";
    const fee = method.startsWith("Card") ? Math.round((order.totalMinor * policy.feeBps) / 10_000) + policy.feeFixedMinor : 0;
    const orderCost = costByOrder.get(order.id) ?? 0;
    gross += order.totalMinor;
    refunds += refund;
    cost += orderCost;
    fees += fee;
    const key = dayKey(order.paidAt!);
    const day = days.get(key) ?? { grossMinor: 0, orders: 0, estimatedProfitMinor: 0 };
    day.grossMinor += order.totalMinor;
    day.orders += 1;
    day.estimatedProfitMinor += order.totalMinor - refund - orderCost - fee;
    days.set(key, day);
    const m = byMethod.get(method) ?? { orders: 0, grossMinor: 0 };
    m.orders += 1;
    m.grossMinor += order.totalMinor;
    byMethod.set(method, m);
  }

  // Zero-filled daily series across the range (max 400 days).
  const byDay: RevenueReport["byDay"] = [];
  for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t < to.getTime() && byDay.length < 400; t += 86_400_000) {
    const key = dayKey(new Date(t));
    byDay.push({ day: key, ...(days.get(key) ?? { grossMinor: 0, orders: 0, estimatedProfitMinor: 0 }) });
  }

  const net = gross - refunds;
  return {
    from,
    to,
    currency,
    orders: inCurrency.length,
    grossMinor: gross,
    confirmedRefundsMinor: refunds,
    netSalesMinor: net,
    supplierCostMinor: cost,
    estimatedPaymentFeesMinor: fees,
    estimatedProfitMinor: net - cost - fees,
    averageOrderMinor: inCurrency.length ? Math.round(gross / inCurrency.length) : 0,
    byDay,
    byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.grossMinor - a.grossMinor),
    byDestination: [...byDestination.entries()]
      .map(([name, v]) => ({ name, orders: v.orders.size, grossMinor: v.grossMinor }))
      .sort((a, b) => b.grossMinor - a.grossMinor)
      .slice(0, 10),
    topPlans: [...byPlan.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity || b.grossMinor - a.grossMinor)
      .slice(0, 10),
    otherCurrencyOrders,
  };
}

export type RevenueRangeKey = "today" | "7d" | "month" | "prev_month" | "custom";

export function resolveRevenueRange(
  key: string | undefined,
  fromRaw?: string,
  toRaw?: string,
  now = new Date(),
): { key: RevenueRangeKey; from: Date; to: Date } {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(startOfDay.getTime() + 86_400_000);
  if (key === "today") return { key, from: startOfDay, to: tomorrow };
  if (key === "month") return { key, from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: tomorrow };
  if (key === "prev_month") {
    return {
      key,
      from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
      to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    };
  }
  if (key === "custom" && fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) && toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
    const from = new Date(`${fromRaw}T00:00:00Z`);
    const to = new Date(new Date(`${toRaw}T00:00:00Z`).getTime() + 86_400_000);
    if (from < to && to.getTime() - from.getTime() <= 400 * 86_400_000) return { key, from, to };
  }
  return { key: "7d", from: new Date(startOfDay.getTime() - 6 * 86_400_000), to: tomorrow };
}

// ---------------------------------------------------------------------------
// Overview

export async function getOpsOverview(db: Database, now = new Date()) {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(startOfDay.getTime() - 6 * 86_400_000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const tomorrow = new Date(startOfDay.getTime() + 86_400_000);
  const [today, week, month, attention, pending, emailFailed, lastBalance] = await Promise.all([
    getRevenueReport(db, startOfDay, tomorrow),
    getRevenueReport(db, weekAgo, tomorrow),
    getRevenueReport(db, monthStart, tomorrow),
    getNeedsAttention(db, now),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.paymentStatus, "pending")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(emailEvents)
      .where(and(eq(emailEvents.status, "failed"), gte(emailEvents.createdAt, weekAgo))),
    db.select().from(providerBalanceSnapshots).orderBy(desc(providerBalanceSnapshots.capturedAt)).limit(1),
  ]);
  return {
    today,
    week,
    month,
    attention,
    pendingPayments: Number(pending[0]?.n ?? 0),
    emailFailures7d: Number(emailFailed[0]?.n ?? 0),
    lastBalance: lastBalance[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Admin alerts (order timeline entries of type admin.alert)

export async function listAdminAlerts(db: Database, limit = 100) {
  const alerts = await db
    .select({
      id: orderEvents.id,
      orderId: orderEvents.orderId,
      message: orderEvents.message,
      metadata: orderEvents.metadata,
      createdAt: orderEvents.createdAt,
      orderNumber: orders.orderNumber,
    })
    .from(orderEvents)
    .leftJoin(orders, eq(orders.id, orderEvents.orderId))
    .where(eq(orderEvents.type, "admin.alert"))
    .orderBy(desc(orderEvents.createdAt))
    .limit(limit);
  const resolved = await db
    .select({ metadata: orderEvents.metadata, createdAt: orderEvents.createdAt })
    .from(orderEvents)
    .where(eq(orderEvents.type, "admin.alert_resolved"));
  const resolvedIds = new Map<string, Date>();
  for (const r of resolved) {
    const alertId = (r.metadata as Record<string, unknown> | null)?.alertId;
    if (typeof alertId === "string") resolvedIds.set(alertId, r.createdAt);
  }
  return alerts.map((a) => {
    const kind = String((a.metadata as Record<string, unknown> | null)?.kind ?? "alert");
    return {
      ...a,
      kind,
      severity: /disputed|review|needs_attention/.test(kind) ? "high" : "medium",
      resolvedAt: resolvedIds.get(a.id) ?? null,
    };
  });
}

/** Whether there is any order that a person must look at right now. */
export function attentionCountsBySeverity(items: AttentionItem[]) {
  return {
    critical: items.filter((i) => i.severity === "critical").length,
    high: items.filter((i) => i.severity === "high").length,
    medium: items.filter((i) => i.severity === "medium").length,
  };
}



// ---------------------------------------------------------------------------
// USDT payments and daily reconciliation

export async function listUsdtPayments(db: Database, limit = 100) {
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: cryptoPayments.id,
        status: cryptoPayments.status,
        amountUsdt: cryptoPayments.amountUsdt,
        originalAmountMinor: cryptoPayments.originalAmountMinor,
        originalCurrency: cryptoPayments.originalCurrency,
        chainId: cryptoPayments.chainId,
        paymentAsset: cryptoPayments.paymentAsset,
        txHash: cryptoPayments.txHash,
        confirmations: cryptoPayments.confirmations,
        expiresAt: cryptoPayments.expiresAt,
        detectedAt: cryptoPayments.detectedAt,
        paidAt: cryptoPayments.paidAt,
        lastError: cryptoPayments.lastError,
        createdAt: cryptoPayments.createdAt,
        orderNumber: orders.orderNumber,
      })
      .from(cryptoPayments)
      .innerJoin(orders, eq(orders.id, cryptoPayments.orderId))
      .orderBy(desc(cryptoPayments.createdAt))
      .limit(limit),
    db.select({ status: cryptoPayments.status, n: sql<number>`count(*)::int` }).from(cryptoPayments).groupBy(cryptoPayments.status),
  ]);
  return {
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Record<string, number>,
  };
}

export interface ReconciliationDay {
  day: string;
  paidOrders: number;
  paidOrdersMinor: number;
  whopPaid: number;
  whopPaidMinor: number;
  usdtPaid: number;
  usdtPaidMinor: number;
  confirmedRefunds: number;
  confirmedRefundsMinor: number;
  casesInReview: number;
  /** Paid orders minus verified provider payments for that day (0 means matched). */
  unmatchedOrders: number;
}

/**
 * Daily comparison of ESIMPROVE paid orders against verified provider
 * payments (Whop webhooks, confirmed USDT transfers) and confirmed refunds.
 */
export async function getReconciliation(db: Database, days = 14, now = new Date()): Promise<ReconciliationDay[]> {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 86_400_000);
  const start = new Date(end.getTime() - days * 86_400_000);
  const [paidOrders, providerPayments, refunds, reviews] = await Promise.all([
    db
      .select({ id: orders.id, paidAt: orders.paidAt, totalMinor: orders.totalMinor })
      .from(orders)
      .where(and(inArray(orders.paymentStatus, EVER_PAID), isNotNull(orders.paidAt), gte(orders.paidAt, start), lt(orders.paidAt, end))),
    db
      .select({ orderId: payments.orderId, provider: payments.provider, amountMinor: payments.amountMinor, orderPaidAt: orders.paidAt })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(inArray(payments.status, EVER_PAID), isNotNull(orders.paidAt), gte(orders.paidAt, start), lt(orders.paidAt, end))),
    db
      .select({ amountMinor: paymentProviderCases.amountMinor, updatedAt: paymentProviderCases.updatedAt })
      .from(paymentProviderCases)
      .where(
        and(
          eq(paymentProviderCases.kind, "refund"),
          eq(paymentProviderCases.providerStatus, "succeeded"),
          eq(paymentProviderCases.needsReview, false),
          gte(paymentProviderCases.updatedAt, start),
          lt(paymentProviderCases.updatedAt, end),
        ),
      ),
    db
      .select({ updatedAt: paymentProviderCases.updatedAt })
      .from(paymentProviderCases)
      .where(and(eq(paymentProviderCases.needsReview, true), gte(paymentProviderCases.updatedAt, start), lt(paymentProviderCases.updatedAt, end))),
  ]);
  const result = new Map<string, ReconciliationDay>();
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    const day = dayKey(new Date(t));
    result.set(day, {
      day,
      paidOrders: 0,
      paidOrdersMinor: 0,
      whopPaid: 0,
      whopPaidMinor: 0,
      usdtPaid: 0,
      usdtPaidMinor: 0,
      confirmedRefunds: 0,
      confirmedRefundsMinor: 0,
      casesInReview: 0,
      unmatchedOrders: 0,
    });
  }
  const matched = new Set<string>();
  for (const o of paidOrders) {
    const d = result.get(dayKey(o.paidAt!));
    if (!d) continue;
    d.paidOrders += 1;
    d.paidOrdersMinor += o.totalMinor;
  }
  for (const p of providerPayments) {
    const d = result.get(dayKey(p.orderPaidAt!));
    if (!d) continue;
    matched.add(p.orderId);
    if (p.provider === "crypto") {
      d.usdtPaid += 1;
      d.usdtPaidMinor += p.amountMinor;
    } else {
      d.whopPaid += 1;
      d.whopPaidMinor += p.amountMinor;
    }
  }
  for (const o of paidOrders) {
    if (!matched.has(o.id)) {
      const d = result.get(dayKey(o.paidAt!));
      if (d) d.unmatchedOrders += 1;
    }
  }
  for (const r of refunds) {
    const d = result.get(dayKey(r.updatedAt));
    if (!d) continue;
    d.confirmedRefunds += 1;
    d.confirmedRefundsMinor += Number(r.amountMinor ?? 0);
  }
  for (const r of reviews) {
    const d = result.get(dayKey(r.updatedAt));
    if (d) d.casesInReview += 1;
  }
  return [...result.values()].reverse();
}
