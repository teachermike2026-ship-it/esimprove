import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminPayments } from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = {
  title: "Admin payments",
  robots: { index: false, follow: false },
};

export default async function AdminPaymentsPage() {
  await requireStaff("/admin/payments", "payments");
  const db = await getDb();
  const payments = await listAdminPayments(db, 200);

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
                      {isWhop ? "Whop" : "Mock"}
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
    </>
  );
}