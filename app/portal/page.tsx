import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listOrdersForUser } from "@/lib/orders";
import { formatMoney, formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ArrowRight, QrIcon, UserIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/portal",
    title: t("portal.metaTitle"),
    robots: { index: false, follow: false },
  });
}

export default async function PortalPage() {
  const { t, href } = await getI18n();
  const user = await requireUser("/portal");
  const db = await getDb();
  const orders = await listOrdersForUser(db, user.id);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("portal.eyebrow")}</p>
          <h1>{t("portal.welcome", { name: user.name })}</h1>
          <p className="muted">{t("portal.signedInAs", { email: user.email })}</p>
        </div>
      </div>

      <div className="split">
        <section className="stack" aria-labelledby="portal-orders">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("portal.history")}</p>
              <h2 id="portal-orders">{t("portal.ordersTitle")}</h2>
            </div>
          </div>
          {orders.length === 0 ? (
            <EmptyState
              title={t("portal.noOrdersTitle")}
              action={{ href: href("/plans"), label: t("common.browsePlans") }}
            >
              {t("portal.noOrdersBody")}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("portal.tableOrder")}</th>
                    <th scope="col">{t("portal.tableCreated")}</th>
                    <th scope="col">{t("portal.tableTotal")}</th>
                    <th scope="col">{t("portal.tableStatus")}</th>
                    <th scope="col">{t("portal.tableAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.orderNumber}</strong>
                      </td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>{formatMoney(order.totalMinor, order.currency)}</td>
                      <td>
                        <StatusBadge status={order.fulfillmentStatus} />
                      </td>
                      <td>
                        <Link
                          className="button button-ghost button-small"
                          href={href(`/portal/orders/${order.orderNumber}`)}
                        >
                          {t("portal.openOrder")} <ArrowRight className="inline-icon" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="checkout-sidebar">
          <section className="card form">
            <h2>
              <UserIcon className="inline-icon" /> {t("portal.account")}
            </h2>
            <dl className="meta-list">
              <div>
                <dt>{t("portal.name")}</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>{t("portal.email")}</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>{t("portal.role")}</dt>
                <dd>{user.role}</dd>
              </div>
              <div>
                <dt>{t("portal.verification")}</dt>
                <dd>{user.emailVerifiedAt ? t("portal.verified") : t("portal.notVerified")}</dd>
              </div>
            </dl>
            <div className="stack-sm">
              <Link
                className="button button-secondary button-small"
                href={href("/portal/profile")}
              >
                {t("portal.profileSecurity")}
              </Link>
              <Link className="button button-ghost button-small" href={href("/portal/support")}>
                {t("portal.supportConversations")}
              </Link>
              <Link className="button button-ghost button-small" href={href("/legal/privacy")}>
                {t("portal.privacyData")}
              </Link>
            </div>
            <p className="form-note">{t("portal.accountNote")}</p>
          </section>
          <section className="card form">
            <h2>
              <QrIcon className="inline-icon" /> {t("portal.needPlan")}
            </h2>
            <p className="muted small">{t("portal.needPlanBody")}</p>
            <Link className="button button-secondary" href={href("/plans")}>
              {t("portal.browsePlans")}
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
