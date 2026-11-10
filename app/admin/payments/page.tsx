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
          <p className="eyebrow">Demo operations</p>
          <h1>Payments</h1>
          <p className="muted">Payment gateway sessions and mock transaction records.</p>
        </div>
      </div>
      {payments.length === 0 ? (
        <div className="card form">
          <p className="muted">No payments recorded yet.</p>
        </div>
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
      <p className="muted small">
        Demo payments never move real funds. Mock gateway records are local to the demo build.
      </p>
    </>
  );
}
