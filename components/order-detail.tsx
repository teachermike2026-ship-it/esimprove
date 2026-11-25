import Link from "next/link";
import type { OrderView } from "@/lib/orders";
import type { RefundRow } from "@/lib/db/schema";
import { StatusBadge } from "@/components/status-badge";
import { formatData, formatDate, formatMoney } from "@/lib/money";
import { AlertIcon, ArrowRight, ClockIcon, QrIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { statusLabel } from "@/lib/i18n/status";

export async function OrderDetail({
  view,
  accessToken,
  refunds = [],
}: {
  view: OrderView;
  accessToken?: string | null;
  refunds?: RefundRow[];
}) {
  const { t, href } = await getI18n();
  const { order, items, events } = view;
  const orderStatus =
    order.status === "failed" ? t("order.needsAttention") : statusLabel(t, order.status);

  return (
    <div className="stack">
      <section className="card form" aria-labelledby="order-summary-title">
        <div className="order-head">
          <div>
            <p className="eyebrow">{t("order.eyebrow")}</p>
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
            <StatusBadge status={order.status} label={orderStatus} />
            <StatusBadge
              status={order.fulfillmentStatus}
              label={statusLabel(t, order.fulfillmentStatus)}
            />
          </div>
        </div>
        <div className="callout">
          <QrIcon className="inline-icon" />
          <p>{t("order.issuedNote")}</p>
        </div>
      </section>

      <section className="card form" aria-labelledby="order-items-title">
        <h2 id="order-items-title">{t("order.items")}</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t("checkout.plan")}</th>
                <th scope="col">{t("order.qty")}</th>
                <th scope="col">{t("order.lineTotal")}</th>
                <th scope="col">{t("order.esim")}</th>
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
                        {formatData(item.dataMb)} ·{" "}
                        {t("cart.daysValidity", { count: item.validityDays })}
                      </span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.totalMinor, item.currency)}</td>
                    <td>
                      {item.esimId && activationHref ? (
                        <Link
                          className="button button-ghost button-small"
                          href={href(activationHref)}
                        >
                          <QrIcon className="inline-icon" /> {t("order.viewActivation")}
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
            <span>{t("checkout.subtotal")}</span>
            <span>{formatMoney(order.subtotalMinor, order.currency)}</span>
          </div>
          <div className="summary-row">
            <span>{t("checkout.taxEstimate")}</span>
            <span>{formatMoney(order.taxMinor, order.currency)}</span>
          </div>
          <div className="summary-total">
            <span>{t("checkout.totalDue")}</span>
            <span>{formatMoney(order.totalMinor, order.currency)}</span>
          </div>
        </div>
      </section>

      <section className="card form" aria-labelledby="order-events-title">
        <h2 id="order-events-title">{t("order.timeline")}</h2>
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
            <p>{t("order.fulfillmentAttention")}</p>
          </div>
        ) : null}
      </section>

      <section className="card form" aria-labelledby="order-refunds-title">
        <h2 id="order-refunds-title">{t("order.refundRequests")}</h2>
        {refunds.length === 0 ? (
          <p className="muted small">{t("order.noRefunds")}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t("order.requested")}</th>
                  <th scope="col">{t("order.amount")}</th>
                  <th scope="col">{t("order.status")}</th>
                  <th scope="col">{t("order.decision")}</th>
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
                      {refund.resolvedAt ? formatDate(refund.resolvedAt) : t("order.awaitingReview")}
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
        <Link className="button button-secondary" href={href("/plans")}>
          {t("order.browseMore")} <ArrowRight className="inline-icon" />
        </Link>
        <Link className="button button-ghost" href={href("/portal")}>
          {t("order.customerPortal")}
        </Link>
      </div>
    </div>
  );
}
