import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listSupportTicketViewsForUser, type SupportCategory } from "@/lib/support";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { CreateSupportTicketForm } from "@/components/support-forms";
import { ArrowRight } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { supportCategoryLabel } from "@/lib/i18n/labels";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/portal/support",
    title: t("support.metaTitle"),
    robots: { index: false, follow: false },
  });
}

export default async function PortalSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { t, href } = await getI18n();
  const user = await requireUser("/portal/support");
  const { order } = await searchParams;
  const db = await getDb();
  const tickets = await listSupportTicketViewsForUser(db, user.id);

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/portal")}>{t("profile.breadcrumbPortal")}</Link>
          </li>
          <li aria-current="page">{t("support.metaTitle")}</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("support.customerSupport")}</p>
          <h1>{t("support.yourConversations")}</h1>
          <p className="muted">{t("support.lead")}</p>
        </div>
      </div>

      <div className="split">
        <section className="stack">
          <h2>{t("support.conversations")}</h2>
          {tickets.length === 0 ? (
            <div className="card form">
              <p className="muted">{t("support.noTicketsInline")}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("support.ticket")}</th>
                    <th scope="col">{t("support.category")}</th>
                    <th scope="col">{t("order.status")}</th>
                    <th scope="col">{t("support.updated")}</th>
                    <th scope="col">{t("portal.openOrder")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <strong>{ticket.subject}</strong>
                        <br />
                        <span className="small muted">{ticket.id}</span>
                      </td>
                      <td>{supportCategoryLabel(t, ticket.category as SupportCategory)}</td>
                      <td>
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td>{formatDate(ticket.updatedAt)}</td>
                      <td>
                        <Link
                          className="button button-ghost button-small"
                          href={href(`/portal/support/${ticket.id}`)}
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
          <CreateSupportTicketForm defaultOrderNumber={order ?? ""} />
          <div className="card form">
            <h2>{t("support.urgentTitle")}</h2>
            <p className="muted small">{t("support.urgentBody")}</p>
            <Link className="button button-secondary" href={href("/portal/profile")}>
              {t("support.openProfile")}
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
