import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminPayments, listAdminWebhookEvents } from "@/lib/admin";
import { getReconciliation, listUsdtPayments } from "@/lib/admin-ops";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = {
  title: "Admin payments",
  robots: { index: false, follow: false },
};

export default async function AdminPaymentsPage() {
  await requireStaff("/admin/payments", "payments");
  const db = await getDb();
  const [payments, webhookLog, usdt, reconciliation] = await Promise.all([
    listAdminPayments(db, 200),
    listAdminWebhookEvents(db, 100),
    listUsdtPayments(db, 100),
    getReconciliation(db, 14),
  ]);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Payments</h1>
          <p className="muted">Payment gateway sessions and verified transaction records.</p>
        </div>
      </div>
      {payments.length === 0 ? (
        <div className="card form">
          <p className="muted">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Payment</th>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Provider</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Provider reference</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(({ payment, orderNumber, orderEmail, orderStatus }) => {
                const isWhop = payment.provider === "whop";
                // Before the webhook confirms, providerPaymentId holds the
                // Whop checkout configuration ID (ch_...). After confirmation
                // it holds the Whop payment ID (pay_...). Both are non-secret.
                return (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.id}</strong>
                    </td>
                    <td>
                      <Link href={`/admin/orders/${orderNumber}`}>{orderNumber}</Link>
                      <br />
                      <span className="small muted">{orderStatus}</span>
                    </td>
                    <td>
                      {orderEmail}
                    </td>
                    <td>
                      {isWhop ? "Whop" : payment.provider === "crypto" ? "Crypto" : payment.provider === "mock" ? "Mock" : payment.provider}
                    </td>
                    <td>{formatMoney(payment.amountMinor, payment.currency)}</td>
                    <td>
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="small muted">
                      {payment.providerPaymentId || "—"}
                    </td>
                    <td>{formatDate(payment.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="card form section-tight" aria-labelledby="webhook-log-title">
        <h2 id="webhook-log-title">Webhook event log</h2>
        <p className="muted small">
          Verified provider events, newest first. Payloads, secrets and card data are never stored; rejected
          (invalid-signature) requests are only written to the server log.
        </p>
        {webhookLog.length === 0 ? (
          <p className="muted small">No webhook events received yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Event</th>
                  <th scope="col">Delivery ID</th>
                </tr>
              </thead>
              <tbody>
                {webhookLog.map((event) => (
                  <tr key={event.id}>
                    <td>{event.processedAt ? formatDate(event.processedAt) : "—"}</td>
                    <td>{event.provider}</td>
                    <td>
                      <code>{event.eventType}</code>
                    </td>
                    <td className="small muted">
                      <code>{event.externalEventId}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card form section-tight" aria-labelledby="usdt-title">
        <h2 id="usdt-title">USDT (BEP-20) payments</h2>
        <p className="muted small">
          Payment requests and on-chain verification results. An order is paid only after the transfer is verified on
          BNB Smart Chain with enough confirmations; a customer&apos;s page alone never marks it paid.
          {" "}
          {Object.entries(usdt.counts)
            .map(([status, n]) => `${n} ${status.replaceAll("_", " ")}`)
            .join(" · ") || "No USDT payments yet."}
        </p>
        {usdt.rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Expected</th>
                  <th>Network / token</th>
                  <th>Status</th>
                  <th>Confirmations</th>
                  <th>Transaction</th>
                  <th>Expires / paid</th>
                  <th>Last verification note</th>
                </tr>
              </thead>
              <tbody>
                {usdt.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.orderNumber}</td>
                    <td>
                      {row.amountUsdt} USDT
                      <br />
                      <span className="small muted">{formatMoney(row.originalAmountMinor, row.originalCurrency)}</span>
                    </td>
                    <td className="small">
                      Chain {row.chainId} · {row.paymentAsset}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{row.confirmations}</td>
                    <td className="small">
                      {row.txHash ? (
                        <a href={`https://bscscan.com/tx/${row.txHash}`} target="_blank" rel="noreferrer">
                          {row.txHash.slice(0, 10)}…{row.txHash.slice(-6)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="small">
                      {row.paidAt ? `paid ${formatDate(row.paidAt)}` : `expires ${formatDate(row.expiresAt)}`}
                    </td>
                    <td className="small">{row.lastError ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="form-note">
          Underpaid, overpaid, wrong-token or late transfers are not accepted automatically: they appear here with a
          verification note and on Needs attention for manual review.
        </p>
      </section>

      <section className="card form section-tight" aria-labelledby="reconciliation-title">
        <h2 id="reconciliation-title">Daily reconciliation (last 14 days, UTC)</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Paid orders</th>
                <th>Whop verified</th>
                <th>USDT confirmed</th>
                <th>Confirmed refunds</th>
                <th>In review</th>
                <th>Unmatched</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.map((day) => (
                <tr key={day.day}>
                  <td className="small">{day.day}</td>
                  <td>
                    {day.paidOrders} · {formatMoney(day.paidOrdersMinor, "USD")}
                  </td>
                  <td>
                    {day.whopPaid} · {formatMoney(day.whopPaidMinor, "USD")}
                  </td>
                  <td>
                    {day.usdtPaid} · {formatMoney(day.usdtPaidMinor, "USD")}
                  </td>
                  <td>
                    {day.confirmedRefunds} · {formatMoney(day.confirmedRefundsMinor, "USD")}
                  </td>
                  <td>{day.casesInReview}</td>
                  <td>{day.unmatchedOrders === 0 ? "0" : <strong>{day.unmatchedOrders}</strong>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="form-note">
          “Unmatched” counts paid orders with no verified provider payment that day. It should always be 0; anything
          else also appears on Needs attention. Refunds use provider-settled amounts.
        </p>
      </section>
    </>
  );
}