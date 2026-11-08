import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getBusinessMetrics } from "@/lib/analytics";
import { listAdminPayments, listAdminRefunds } from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = {
  title: "Admin finance",
  robots: { index: false, follow: false },
};

export default async function AdminFinancePage() {
  await requireAdmin();
  const db = await getDb();
  const metrics = await getBusinessMetrics(db);
  const payments = await listAdminPayments(db, 200);
  const refunds = await listAdminRefunds(db, 200);

  const approvedRefunds = refunds.filter((entry) => entry.refund.status === "approved");
  const refundTotalMinor = approvedRefunds.reduce(
    (total, entry) => total + entry.refund.amountMinor,
    0,
  );

  const paymentFeesMinor = metrics.paymentFeesMinor ?? 0;
  const realizedGrossProfitMinor = Math.max(
    0,
    metrics.netRevenueMinor - metrics.supplierCostMinor - refundTotalMinor - paymentFeesMinor,
  );
  const realizedMarginBps =
    metrics.grossSalesMinor > 0
      ? Math.round((realizedGrossProfitMinor / metrics.grossSalesMinor) * 10_000)
      : null;

  const cards = [
    { label: "Gross sales", value: formatMoney(metrics.grossSalesMinor, "USD") },
    { label: "Refunds", value: formatMoney(refundTotalMinor, "USD") },
    { label: "Net revenue", value: formatMoney(metrics.netRevenueMinor, "USD") },
    { label: "Supplier cost", value: formatMoney(metrics.supplierCostMinor, "USD") },
    { label: "Payment fees", value: formatMoney(paymentFeesMinor, "USD") },
    { label: "Estimated gross profit", value: formatMoney(metrics.estimatedGrossProfitMinor, "USD") },
    { label: "Realized gross profit", value: formatMoney(realizedGrossProfitMinor, "USD") },
    { label: "Gross margin", value: realizedMarginBps === null ? "—" : `${(realizedMarginBps / 10).toFixed(2)}%` },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Business operations</p>
          <h1>Finance</h1>
          <p className="muted">Revenue, refunds, and profitability reporting.</p>
        </div>
      </div>

      <div className="stat-grid">
        {cards.map((card) => (
          <article className="card stat" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <section className="card form section-tight">
        <h2>Transaction history</h2>
        {payments.length === 0 ? (
          <p className="muted">No payment transactions recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Payment</th>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(({ payment, orderNumber, orderEmail, orderStatus }) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.id}</strong>
                      <br />
                      <span className="small muted">{payment.provider}</span>
                    </td>
                    <td>
                      <Link href={`/admin/orders/${orderNumber}`}>{orderNumber}</Link>
                      <br />
                      <span className="small muted">{orderStatus}</span>
                    </td>
                    <td>
                      {orderEmail}
                    </td>
                    <td>{formatMoney(payment.amountMinor, payment.currency)}</td>
                    <td>
                      <StatusBadge status={payment.status} />
                    </td>
                    <td>{formatDate(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card form section-tight">
        <h2>Refund ledger</h2>
        {approvedRefunds.length === 0 ? (
          <p className="muted">No approved refunds recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Refund</th>
                  <th scope="col">Order</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Approved</th>
                </tr>
              </thead>
              <tbody>
                {approvedRefunds.map(({ refund, orderNumber }) => (
                  <tr key={refund.id}>
                    <td>
                      <strong>{refund.id}</strong>
                    </td>
                    <td>
                      <Link href={`/admin/orders/${orderNumber}`}>{orderNumber}</Link>
                    </td>
                    <td>{formatMoney(refund.amountMinor, refund.currency)}</td>
                    <td>
                      <StatusBadge status={refund.status} />
                    </td>
                    <td>{formatDate(refund.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted small">
        Reconciliation requires connected payment settlements and provider cost feeds. Until then,
        profit figures are explicitly estimated from stored costs and approved refunds.
      </p>
    </>
  );
}
