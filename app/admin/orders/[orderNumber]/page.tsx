import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getAdminOrderDetail } from "@/lib/admin";
import { OrderDetail } from "@/components/order-detail";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { refundOrderViaProviderAction, retryOrderJobsAction, retryJobAction } from "../../actions";
import { AlertIcon, RetryIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Admin order detail",
  robots: { index: false, follow: false },
};

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ retried?: string; refundRequested?: string; refundError?: string }>;
}) {
  const { orderNumber } = await params;
  const { retried, refundRequested, refundError } = await searchParams;
  const staff = await requireStaff("/admin/orders", "orders");
  // Retrying fulfillment mutates job state; read-only staff must not see a
  // button that the server action would reject.
  const canRetry = hasPermission(staff.role, "orders.write");
  // Provider payment records are a finance read surface. Support can help with
  // order status but must not see payment identifiers or amounts.
  const canViewPayments = hasPermission(staff.role, "invoices.read");
  const canRefund = hasPermission(staff.role, "refunds.write");
  const db = await getDb();
  const detail = await getAdminOrderDetail(db, orderNumber, {
    includePayments: canViewPayments,
  });
  if (!detail) notFound();
  const { view, payments, jobs, emails } = detail;

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/admin/orders">Orders</Link>
          </li>
          <li aria-current="page">{orderNumber}</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin order</p>
          <h1>{orderNumber}</h1>
          <p className="muted">
            Created {formatDate(view.order.createdAt)} · {view.order.email || "Guest checkout (no email)"}
          </p>
        </div>
        <div className="pill-row">
          <StatusBadge status={view.order.status} />
          <StatusBadge status={view.order.paymentStatus} />
          <StatusBadge status={view.order.fulfillmentStatus} />
        </div>
      </div>

      {retried ? (
        <div className="callout section-tight" role="status">
          <RetryIcon className="inline-icon" />
          <p>{retried} fulfillment job(s) queued for retry.</p>
        </div>
      ) : null}

      {jobs.some(({ job }) => job.status === "failed") ? (
        <div className="callout callout-warning section-tight">
          <AlertIcon className="inline-icon" />
          <p>
            One or more demo fulfillment jobs failed. Inspect the error
            {canRetry ? ", then retry the job or use the order-level retry." : "."} No real
            supplier order exists.
          </p>
        </div>
      ) : null}

      <div className="grid grid-2">
        {canViewPayments ? (
          <section className="card form">
            <h2>Payments</h2>
            {payments.length === 0 ? (
              <p className="muted small">No payment record.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Provider</th>
                      <th scope="col">Status</th>
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>
                          {payment.provider}
                          <br />
                          <code>{payment.providerPaymentId}</code>
                        </td>
                        <td>
                          <StatusBadge status={payment.status} />
                        </td>
                        <td>{formatMoney(payment.amountMinor, payment.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {refundRequested ? (
              <p className="callout callout-success small" role="status">
                Refund requested at the provider. The order is marked refunded when the verified refund webhook arrives.
              </p>
            ) : null}
            {refundError ? (
              <p className="callout callout-warning small" role="alert">
                {refundError}
              </p>
            ) : null}
            {canRefund
              ? payments
                  .filter(
                    (payment) =>
                      payment.provider === "whop" &&
                      payment.providerPaymentId.startsWith("pay_") &&
                      ["paid", "disputed", "partially_refunded"].includes(payment.status),
                  )
                  .map((payment) => (
                    <form key={payment.id} action={refundOrderViaProviderAction} className="stack admin-refund-form">
                      <input type="hidden" name="orderNumber" value={view.order.orderNumber} />
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <label className="checkbox-row small">
                        <input type="checkbox" name="confirm" value="yes" required /> Refund the full{" "}
                        {formatMoney(payment.amountMinor, payment.currency)} to the customer through Whop
                        {payment.status === "paid" && view.order.fulfillmentStatus !== "delivered"
                          ? " (the eSIM was not delivered)"
                          : ""}
                      </label>
                      <button className="button button-secondary button-small" type="submit">
                        Refund via Whop
                      </button>
                    </form>
                  ))
              : null}
          </section>
        ) : null}

        <section className="card form">
          <h2>Fulfillment jobs</h2>
          {jobs.length === 0 ? (
            <p className="muted small">No jobs have been queued.</p>
          ) : (
            <div className="stack">
              {jobs.map(({ job, planName }) => (
                <div key={job.id} className="admin-job-row">
                  <div>
                    <strong>{planName}</strong>
                    <p className="small muted">
                      {job.status} · attempt {job.attempts}/{job.maxAttempts}
                      {job.lastError ? ` · ${job.lastError}` : ""}
                    </p>
                  </div>
                  {canRetry ? (
                    <form action={retryJobAction}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <button
                        className="button button-secondary button-small"
                        type="submit"
                        disabled={!["failed", "queued", "under_investigation", "manual_review"].includes(job.status)}
                      >
                        <RetryIcon className="inline-icon" /> Retry
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {canRetry &&
          jobs.some(({ job }) =>
            ["failed", "queued", "under_investigation"].includes(job.status),
          ) ? (
            <form action={retryOrderJobsAction}>
              <input type="hidden" name="orderId" value={view.order.id} />
              <input type="hidden" name="orderNumber" value={view.order.orderNumber} />
              <button className="button button-ghost button-small" type="submit">
                Retry all failed/queued jobs for this order
              </button>
            </form>
          ) : null}
        </section>
      </div>

      <div className="section-tight">
        <OrderDetail view={view} />
      </div>

      <section className="card form section-tight">
        <h2>Mock email log</h2>
        {emails.length === 0 ? (
          <p className="muted small">No email events for this order.</p>
        ) : (
          <div className="stack">
            {emails.map((email) => (
              <details key={email.id} className="email-event">
                <summary>
                  {email.subject} · {email.status} · {formatDate(email.createdAt)}
                </summary>
                <p className="small muted">
                  To {email.recipient} · template {email.template}
                </p>
                <pre>{email.bodyText}</pre>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
