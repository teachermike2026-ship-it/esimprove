import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrderByNumber, verifyOrderAccessToken } from "@/lib/orders";
import { readGuestOrders } from "@/lib/guest-orders";
import { findGuestOrderAction, forgetGuestOrderAction } from "@/app/orders/actions";
import { StatusBadge } from "@/components/status-badge";
import { AlertIcon, ArrowRight, LockIcon, QrIcon } from "@/components/icons";
import { formatMoney } from "@/lib/money";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { statusLabel } from "@/lib/i18n/status";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/orders",
    title: t("guest.ordersMetaTitle"),
    robots: { index: false, follow: false },
  });
}

/**
 * Guest order access without an account: the orders this device placed (kept
 * in an HTTP-only cookie and re-verified here) and a form to reopen an order
 * from its private link or access code.
 */
export default async function GuestOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ find?: string }>;
}) {
  const { t, href, locale } = await getI18n();
  const { find } = await searchParams;
  const db = await getDb();
  const user = await getCurrentUser();

  const entries = await readGuestOrders();
  const orders = [];
  for (const entry of entries) {
    const order = await getOrderByNumber(db, entry.orderNumber);
    if (order && (await verifyOrderAccessToken(db, order.id, entry.token))) {
      orders.push({ order, token: entry.token });
    }
  }

  return (
    <div className="stack guest-orders">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("guest.eyebrow")}</p>
          <h1>{t("guest.ordersTitle")}</h1>
          <p className="muted">{t("guest.ordersLead")}</p>
        </div>
      </div>

      {user ? (
        <div className="callout" role="note">
          <QrIcon className="inline-icon" />
          <p>
            {t("guest.signedInNote")}{" "}
            <Link href={href("/portal/orders")}>{t("guest.accountOrdersLink")}</Link>
          </p>
        </div>
      ) : null}

      <section className="card form" aria-labelledby="device-orders-title">
        <h2 id="device-orders-title">{t("guest.deviceOrdersTitle")}</h2>
        {orders.length === 0 ? (
          <p className="muted">{t("guest.deviceOrdersEmpty")}</p>
        ) : (
          <ul className="guest-order-list">
            {orders.map(({ order, token }) => (
              <li key={order.id} className="guest-order-row">
                <div>
                  <strong>{order.orderNumber}</strong>
                  <span className="small muted">
                    {" "}
                    · {formatMoney(order.totalMinor, order.currency, locale)}
                  </span>
                  <div className="pill-row">
                    <StatusBadge status={order.status} label={statusLabel(t, order.status)} />
                  </div>
                </div>
                <div className="guest-order-actions">
                  <Link
                    className="button button-small"
                    href={`${href(`/orders/${order.orderNumber}`)}?token=${encodeURIComponent(token)}`}
                  >
                    {t("guest.openOrder")} <ArrowRight className="inline-icon" />
                  </Link>
                  <form action={forgetGuestOrderAction}>
                    <input type="hidden" name="orderNumber" value={order.orderNumber} />
                    <button className="button button-ghost button-small" type="submit">
                      {t("guest.forget")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="form-note">{t("guest.deviceOrdersNote")}</p>
      </section>

      <section className="card form" aria-labelledby="find-order-title">
        <h2 id="find-order-title">
          <LockIcon className="inline-icon" /> {t("guest.findTitle")}
        </h2>
        <p className="muted">{t("guest.findLead")}</p>
        {find === "notfound" ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <span>{t("guest.findNotFound")}</span>
          </div>
        ) : null}
        {find === "limited" ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <span>{t("guest.findLimited")}</span>
          </div>
        ) : null}
        <form action={findGuestOrderAction} className="form">
          <div className="field">
            <label htmlFor="guest-access">{t("guest.findAccessLabel")}</label>
            <input
              id="guest-access"
              name="access"
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              maxLength={2048}
            />
          </div>
          <div className="field">
            <label htmlFor="guest-order-number">{t("guest.findOrderNumberLabel")}</label>
            <input
              id="guest-order-number"
              name="orderNumber"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
              placeholder="ES-261127-ABC123"
            />
            <p className="form-note">{t("guest.findOrderNumberNote")}</p>
          </div>
          <button className="button" type="submit">
            {t("guest.findSubmit")}
          </button>
        </form>
      </section>
    </div>
  );
}
