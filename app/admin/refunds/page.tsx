import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { listAdminRefunds } from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { approveRefundAction, rejectRefundAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin refunds",
  robots: { index: false, follow: false },
};

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; processed?: string; rejected?: string }>;
}) {
  const staff = await requireStaff("/admin/refunds", "refunds");
  const canApprove = hasPermission(staff.role, "refunds.write");
  const { error, processed, rejected } = await searchParams;
  const db = await getDb();
  const refunds = await listAdminRefunds(db, 200);
  const pending = refunds.filter(({ refund }) => refund.status === "requested").length;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Refunds</h1>
          <p className="muted">
            Refund requests awaiting a review decision, plus approved and rejected history. All
            refunds are mock operations; no real money moves.
          </p>
        </div>
        <span className="badge badge-demo">{pending} awaiting review</span>
      </div>
      {processed === "1" ? (
        <div className="callout callout-success section-tight" role="status">
          <p>Refund approved and applied to the mock payment. The customer notice was logged locally.</p>
        </div>
      ) : null}
      {rejected === "1" ? (
        <div className="callout section-tight" role="status">
          <p>Refund rejected. The reservation was released and the decision was recorded.</p>
        </div>
      ) : null}
      {error ? (
        <div className="form-error section-tight" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <div className="callout callout-warning section-tight">
        <p>
          Refund decisions update only the local payment record. No payment gateway call is made,
          because live payments are not configured.
        </p>
      </div>
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
                <th scope="col">Decision</th>
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
                    {customerName || "Guest checkout"}
                    <br />
                    <span className="small muted">{customerEmail || "No email (guest)"}</span>
                  </td>
                  <td>{formatMoney(refund.amountMinor, refund.currency)}</td>
                  <td>
                    <StatusBadge status={refund.status} />
                  </td>
                  <td>{formatDate(refund.createdAt)}</td>
                  <td>
                    {refund.status === "requested" ? (
                      canApprove ? (
                        <div className="stack-sm">
                          <form action={approveRefundAction}>
                            <input type="hidden" name="refundId" value={refund.id} />
                            <button className="button button-small" type="submit">
                              Approve
                            </button>
                          </form>
                          <details>
                            <summary className="button button-ghost button-small">Reject…</summary>
                            <form action={rejectRefundAction} className="form section-tight">
                              <input type="hidden" name="refundId" value={refund.id} />
                              <div className="field">
                                <label htmlFor={`reject-note-${refund.id}`}>
                                  Reason shown to the customer
                                </label>
                                <textarea
                                  id={`reject-note-${refund.id}`}
                                  name="note"
                                  required
                                  minLength={5}
                                  maxLength={1000}
                                  rows={3}
                                />
                              </div>
                              <button className="button button-secondary button-small" type="submit">
                                Confirm rejection
                              </button>
                            </form>
                          </details>
                        </div>
                      ) : (
                        <span className="small muted">Administrator approval required</span>
                      )
                    ) : (
                      <div>
                        <span className="small muted">
                          {refund.resolvedAt ? formatDate(refund.resolvedAt) : "—"}
                        </span>
                        {refund.resolutionNote ? (
                          <p className="small muted">{refund.resolutionNote}</p>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        Payment execution remains administrator-only. Finance and support roles have read-only
        access. Real gateway confirmation is still required before any live refund could be issued.
      </p>
    </>
  );
}
