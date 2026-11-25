import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getOrderById } from "@/lib/orders";
import { getSupportTicketForUser, type SupportCategory } from "@/lib/support";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { ReplySupportTicketForm } from "@/components/support-forms";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { supportCategoryLabel, supportPriorityLabel } from "@/lib/i18n/labels";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/portal/support",
    title: t("support.ticketEyebrow"),
    robots: { index: false, follow: false },
  });
}

export default async function PortalSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { t, href } = await getI18n();
  const { ticketId } = await params;
  const user = await requireUser(`/portal/support/${ticketId}`);
  const db = await getDb();
  const ticket = await getSupportTicketForUser(db, ticketId, user.id);
  if (!ticket) notFound();
  const order = ticket.orderId ? await getOrderById(db, ticket.orderId) : null;

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href={href("/portal")}>{t("profile.breadcrumbPortal")}</Link>
          </li>
          <li>
            <Link href={href("/portal/support")}>{t("support.metaTitle")}</Link>
          </li>
          <li aria-current="page">{ticket.id}</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("support.ticketEyebrow")}</p>
          <h1>{ticket.subject}</h1>
          <p className="muted">
            {supportCategoryLabel(t, ticket.category as SupportCategory)} ·{" "}
            {t("support.priorityLabel", {
              priority: supportPriorityLabel(t, ticket.priority),
            })}
            {order ? (
              <>
                {" "}
                · {t("payment.order")}{" "}
                <Link href={href(`/portal/orders/${order.orderNumber}`)}>
                  {order.orderNumber}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <section className="card form" aria-labelledby="support-conversation-title">
        <h2 id="support-conversation-title">{t("support.conversations")}</h2>
        <ol className="timeline">
          {ticket.messages.map((message) => (
            <li key={message.id} className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <strong>
                  {message.authorType === "staff" ? t("support.supportTeam") : t("support.you")}
                </strong>
                <p>{message.body}</p>
                <span className="small muted">{formatDate(message.createdAt)}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {ticket.status === "closed" ? (
        <div className="callout callout-warning section-tight">
          <p>{t("support.ticketClosed")}</p>
        </div>
      ) : (
        <div className="section-tight">
          <ReplySupportTicketForm ticketId={ticket.id} />
        </div>
      )}

      <div className="hero-actions section-tight">
        <Link className="button button-secondary" href={href("/portal/support")}>
          {t("support.allConversations")}
        </Link>
      </div>
    </>
  );
}
