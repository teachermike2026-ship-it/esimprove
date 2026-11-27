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
import { addOrderNoteAction, resendDeliveryEmailAction } from "../../ops-actions";
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
  searchParams: Promise<{ retried?: string; refundRequested?: string; refundError?: string; notice?: string }>;
}) {
  const { orderNumber } = await params;
  const { retried, refundRequested, refundError, notice } = await searchParams;
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

      {notice ? (
        <div className="callout section-tight" role="status">
          <p>{notice}</p>
        </div>
      ) : null}

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
            One or more fulfillment jobs failed. Inspect the error
            {canRetry ? ", then retry the job or use the order-level retry." : "."} A retry reuses the
            same supplier transaction ID, so it never buys a second eSIM for the same line.
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

      {canViewPayments ? (
        <section className="card form section-tight">
          <h2>Line items, cost and margin</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Qty</th>
                  <th>Selling price</th>
                  <th>Supplier cost</th>
                  <th>Gross margin</th>
                  <th>Supplier product</th>
                  <th>eSIMs (ICCID)</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.planName}
                      <br />
                      <span className="small muted">
                        {item.dataMb ? `${item.dataMb} MB` : ""} · {item.validityDays} days
                      </span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.totalMinor, item.currency)}</td>
                    <td>{formatMoney(item.costMinor, item.currency)}</td>
                    <td>{formatMoney(item.totalMinor - item.costMinor, item.currency)}</td>
                    <td className="small">
                      {item.supplierKey} · {item.supplierProductId}
                    </td>
                    <td className="small">
                      {item.esims.length === 0 ? "None issued" : item.esims.map((e) => e.iccid ?? e.id).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="form-note">
            QR codes and activation codes are never shown in the admin console; customers see them on their own order page.
          </p>
        </section>
      ) : null}

      <div className="grid grid-2 section-tight">
        <section className="card form">
          <h2>Internal notes</h2>
          {view.events.filter((e) => e.type === "admin.note").length === 0 ? (
            <p className="muted small">No notes yet. Notes are visible to staff only.</p>
          ) : (
            <ul className="timeline">
              {view.events
                .filter((e) => e.type === "admin.note")
                .map((note) => (
                  <li key={note.id}>
                    <div>
                      <span>{note.message}</span>
                      <br />
                      <span className="small muted">
                        {String((note.metadata as Record<string, unknown> | null)?.authorEmail ?? "staff")} ·{" "}
                        {formatDate(note.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          )}
          {canRetry ? (
            <form action={addOrderNoteAction} className="form">
              <input type="hidden" name="orderNumber" value={view.order.orderNumber} />
              <label className="small" htmlFor="order-note">
                Add a note
              </label>
              <textarea id="order-note" name="note" rows={3} maxLength={2000} required />
              <button className="button button-small button-secondary" type="submit">
                Save note
              </button>
            </form>
          ) : null}
        </section>

        <section className="card form">
          <h2>Delivery email</h2>
          {view.order.fulfillmentStatus !== "delivered" ? (
            <p className="muted small">Available once the order is delivered.</p>
          ) : !view.order.email ? (
            <p className="muted small">Guest order without an email address: the customer uses the private order link.</p>
          ) : canRetry ? (
            <form action={resendDeliveryEmailAction} className="form">
              <input type="hidden" name="orderNumber" value={view.order.orderNumber} />
              <p className="small muted">
                Sends the real stored eSIM details again to the order email. Nothing is regenerated and no supplier call is made.
              </p>
              <label className="checkbox">
                <input type="checkbox" name="confirm" value="yes" required />
                <span>Send the eSIM delivery email to this customer again.</span>
              </label>
              <button className="button button-small" type="submit">
                Resend delivery email
              </button>
            </form>
          ) : (
            <p className="muted small">Your role cannot resend emails.</p>
          )}
        </section>
      </div>

      <div className="section-tight">
        <OrderDetail view={view} includeInternalEvents />
      </div>

      <section className="card form section-tight">
        <h2>Email log for this order</h2>
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
