import Link from "next/link";
import type { OrderView } from "@/lib/orders";
import type { RefundRow } from "@/lib/db/schema";
import { fulfillmentStatusLabel, orderStatusLabel } from "@/lib/orders";
import { StatusBadge } from "@/components/status-badge";
import { formatData, formatDate, formatMoney } from "@/lib/money";
import { AlertIcon, ArrowRight, ClockIcon, QrIcon } from "@/components/icons";

export function OrderDetail({
  view,
  accessToken,
  refunds = [],
}: {
  view: OrderView;
  accessToken?: string | null;
  refunds?: RefundRow[];
}) {
  const { order, items, events } = view;
  return (
    <div className="stack">
      <section className="card form" aria-labelledby="order-summary-title">
        <div className="order-head">
          <div>
            <p className="eyebrow">Order</p>
            <h2 id="order-summary-title">{order.orderNumber}</h2>
            <div className="order-meta">
              <span>
                <ClockIcon className="inline-icon" /> {formatDate(order.createdAt)}
              </span>
              <span>{order.email}</span>
              <span>{order.customerName}</span>
            </div>
          </div>
          <div className="pill-row">
            <StatusBadge status={order.status} label={orderStatusLabel(order.status)} />
            <StatusBadge
              status={order.fulfillmentStatus}
              label={fulfillmentStatusLabel(order.fulfillmentStatus)}
            />
          </div>
        </div>
        <div className="callout">
          <QrIcon className="inline-icon" />
          <p>
            Your eSIM will be issued once payment is confirmed. Activation details will appear
            in this order as soon as your eSIM is ready.
          </p>
        </div>
      </section>

      <section className="card form" aria-labelledby="order-items-title">
        <h2 id="order-items-title">Items</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Qty</th>
                <th scope="col">Line total</th>
                <th scope="col">eSIM</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const activationHref = item.esimId
                  ? accessToken
                    ? `/orders/${order.orderNumber}/esim/${item.esimId}?token=${encodeURIComponent(accessToken)}`
                    : `/portal/esims/${item.esimId}`
                  : null;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.planName}</strong>
                      <br />
                      <span className="muted small">
                        {formatData(item.dataMb)} · {item.validityDays} days
                      </span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.totalMinor, item.currency)}</td>
                    <td>
                      {item.esimId && activationHref ? (
                        <Link className="button button-ghost button-small" href={activationHref}>
                          <QrIcon className="inline-icon" /> View activation
                        </Link>
                      ) : (
                        <StatusBadge status={order.fulfillmentStatus} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="summary-card" style={{ padding: 0 }}>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotalMinor, order.currency)}</span>
          </div>
          <div className="summary-row">
            <span>Tax (estimate)</span>
            <span>{formatMoney(order.taxMinor, order.currency)}</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>{formatMoney(order.totalMinor, order.currency)}</span>
          </div>
        </div>
      </section>

      <section className="card form" aria-labelledby="order-events-title">
        <h2 id="order-events-title">Order timeline</h2>
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id} className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <strong>{event.type.replaceAll(".", " · ")}</strong>
                <span>{event.message}</span>
                <br />
                <span className="small muted">{formatDate(event.createdAt)}</span>
              </div>
            </li>
          ))}
        </ol>
        {order.fulfillmentStatus === "failed" ? (
          <div className="callout callout-warning">
            <AlertIcon className="inline-icon" />
            <p>
              Fulfillment needs attention. Please contact support with your order number.
            </p>
          </div>
        ) : null}
      </section>

      <section className="card form" aria-labelledby="order-refunds-title">
        <h2 id="order-refunds-title">Refund requests</h2>
        {refunds.length === 0 ? (
          <p className="muted small">
            No refund requests have been recorded for this order.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Requested</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Decision</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td>{formatDate(refund.createdAt)}</td>
                    <td>{formatMoney(refund.amountMinor, refund.currency)}</td>
                    <td>
                      <StatusBadge status={refund.status} />
                    </td>
                    <td>
                      {refund.resolvedAt ? formatDate(refund.resolvedAt) : "Awaiting review"}
                      {refund.resolutionNote ? (
                        <p className="small muted">{refund.resolutionNote}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="hero-actions">
        <Link className="button button-secondary" href="/plans">
          Browse more plans <ArrowRight className="inline-icon" />
        </Link>
        <Link className="button button-ghost" href="/portal">
          Customer portal
        </Link>
      </div>
    </div>
  );
}
