import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { fulfillmentJobs, orderItems, orders, payments, refunds } from "@/lib/db/schema";

export interface BusinessMetrics {
  grossSalesMinor: number;
  refundTotalMinor: number;
  netRevenueMinor: number;
  supplierCostMinor: number;
  estimatedGrossProfitMinor: number;
  estimatedGrossMarginBps: number | null;
  paymentFeesMinor: number | null;
  successfulPayments: number;
  failedPayments: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  delayedFulfillments: number;
  averageOrderValueMinor: number;
  paidOrderCount: number;
  refundedOrderCount: number;
}

/**
 * Computes demo-mode business metrics from the real operational tables.
 *
 * - Gross sales: paid order totals.
 * - Refunds: approved refund amounts against those orders.
 * - Supplier cost: stored order item costs for paid orders.
 * - Estimated gross profit: net revenue minus supplier cost. Payment processing
 *   fees are not captured by the mock gateway, so they are reported as unknown.
 */
export async function getBusinessMetrics(db: Database): Promise<BusinessMetrics> {
  const paidOrders = await db
    .select({
      id: orders.id,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      fulfillmentStatus: orders.fulfillmentStatus,
    })
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"));

  const grossSalesMinor = paidOrders.reduce((total, order) => total + order.totalMinor, 0);
  const paidOrderIds = new Set(paidOrders.map((order) => order.id));

  const refundRows = await db.select().from(refunds);
  const approvedRefunds = refundRows.filter((refund) => refund.status === "approved");
  const refundTotalMinor = approvedRefunds.reduce((total, refund) => total + refund.amountMinor, 0);
  const refundedOrderIds = new Set(approvedRefunds.map((refund) => refund.orderId));
  const refundedOrderCount = paidOrders.filter((order) => refundedOrderIds.has(order.id)).length;

  const orderItemsRows = await db.select().from(orderItems);
  const supplierCostMinor = orderItemsRows
    .filter((item) => paidOrderIds.has(item.orderId))
    .reduce((total, item) => total + item.costMinor * item.quantity, 0);

  const estimatedGrossProfitMinor =
    paidOrders.length === 0 ? 0 : grossSalesMinor - supplierCostMinor - refundTotalMinor;
  const estimatedGrossMarginBps =
    grossSalesMinor > 0 ? Math.round((estimatedGrossProfitMinor / grossSalesMinor) * 10_000) : null;

  const successfulPayments = await db.select().from(payments).where(eq(payments.status, "paid"));
  const failedPayments = await db.select().from(payments).where(eq(payments.status, "failed"));

  const deliveredOrders = paidOrders.filter(
    (order) => order.fulfillmentStatus === "delivered",
  );
  const failedDeliveries = paidOrders.filter(
    (order) => order.fulfillmentStatus === "failed",
  ).length;

  const jobs = await db.select().from(fulfillmentJobs);
  const delayedFulfillments = jobs.filter(
    (job) =>
      paidOrderIds.has(job.orderId) &&
      (job.status === "queued" || job.status === "provisioning"),
  ).length;

  const averageOrderValueMinor =
    paidOrders.length > 0 ? grossSalesMinor / paidOrders.length : 0;

  return {
    grossSalesMinor,
    refundTotalMinor,
    netRevenueMinor: Math.max(0, grossSalesMinor - refundTotalMinor),
    supplierCostMinor,
    estimatedGrossProfitMinor,
    estimatedGrossMarginBps,
    paymentFeesMinor: null,
    successfulPayments: successfulPayments.length,
    failedPayments: failedPayments.length,
    successfulDeliveries: deliveredOrders.length,
    failedDeliveries,
    delayedFulfillments,
    averageOrderValueMinor,
    paidOrderCount: paidOrders.length,
    refundedOrderCount,
  };
}

export function formatMetricsMoney(amountMinor: number, currency = "USD") {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatted.format(amountMinor / 100);
}
