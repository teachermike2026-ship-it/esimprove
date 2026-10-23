import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getAdminOrderDetail } from "@/lib/admin";
import { OrderDetail } from "@/components/order-detail";
import { formatDate, formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { retryOrderJobsAction, retryJobAction } from "../../actions";
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
  searchParams: Promise<{ retried?: string }>;
}) {
  const { orderNumber } = await params;
  const { retried } = await searchParams;
  await requireAdmin();
  const db = await getDb();
  const detail = await getAdminOrderDetail(db, orderNumber);
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
            Created {formatDate(view.order.createdAt)} · {view.order.email}
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
            One or more demo fulfillment jobs failed. Inspect the error, then retry the job or
            use the order-level retry. No real supplier order exists.
          </p>
        </div>
      ) : null}

      <div className="grid grid-2">
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
        </section>

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
                  <form action={retryJobAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      className="button button-secondary button-small"
                      type="submit"
                      disabled={!["failed", "queued", "under_investigation"].includes(job.status)}
                    >
                      <RetryIcon className="inline-icon" /> Retry
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          {jobs.some(({ job }) =>
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
