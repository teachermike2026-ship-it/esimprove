import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listAdminRefunds } from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { approveRefundAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin refunds",
  robots: { index: false, follow: false },
};

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; processed?: string }>;
}) {
  const staff = await requireStaff("/admin/refunds", "refunds");
  const canApprove = hasPermission(staff.role, "refunds.write");
  const { error, processed } = await searchParams;
  const db = await getDb();
  const refunds = await listAdminRefunds(db, 200);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Demo operations</p>
          <h1>Refunds</h1>
          <p className="muted">Refund requests awaiting approval and processed refund history.</p>
        </div>
      </div>
      {processed === "1" ? (
        <div className="callout callout-success section-tight" role="status">
          <p>Refund approved and applied to the mock payment.</p>
        </div>
      ) : null}
      {error ? (
        <div className="form-error section-tight" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {refunds.length === 0 ? (
        <div className="card form">
          <p className="muted">No refund requests have been recorded.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Refund</th>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Requested</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map(({ refund, orderNumber, customerEmail, customerName }) => (
                <tr key={refund.id}>
                  <td>
                    <strong>{refund.id}</strong>
                    <br />
                    <span className="small muted">{refund.reason}</span>
                  </td>
                  <td>
                    <Link href={`/admin/orders/${orderNumber}`}>{orderNumber}</Link>
                  </td>
                  <td>
                    {customerName}
                    <br />
                    <span className="small muted">{customerEmail}</span>
                  </td>
                  <td>{formatMoney(refund.amountMinor, refund.currency)}</td>
                  <td>
                    <StatusBadge status={refund.status} />
                  </td>
                  <td>{formatDate(refund.createdAt)}</td>
                  <td>
                    {refund.status === "requested" ? (
                      canApprove ? (
                        <form action={approveRefundAction}>
                          <input type="hidden" name="refundId" value={refund.id} />
                          <button className="button button-small" type="submit">
                            Approve
                          </button>
                        </form>
                      ) : (
                        <span className="small muted">Administrator approval required</span>
                      )
                    ) : (
                      <span className="small muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        Demo refund approvals move mock payments through the payment state machine. Refund
        execution is administrator-only; finance and support roles have read-only access. Real
        gateway confirmation is still required before any live refund could be issued.
      </p>
    </>
  );
}
