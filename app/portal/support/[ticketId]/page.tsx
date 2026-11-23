import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getOrderById } from "@/lib/orders";
import {
  getSupportTicketForUser,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { ReplySupportTicketForm } from "@/components/support-forms";

export const metadata: Metadata = {
  title: "Support ticket",
  robots: { index: false, follow: false },
};

export default async function PortalSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
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
            <Link href="/portal">Portal</Link>
          </li>
          <li>
            <Link href="/portal/support">Support</Link>
          </li>
          <li aria-current="page">{ticket.id}</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Support ticket</p>
          <h1>{ticket.subject}</h1>
          <p className="muted">
            {SUPPORT_CATEGORY_LABELS[ticket.category as SupportCategory] ?? ticket.category} ·{" "}
            {SUPPORT_PRIORITY_LABELS[ticket.priority as SupportPriority] ?? ticket.priority} priority
            {order ? (
              <>
                {" "}· Order{" "}
                <Link href={`/portal/orders/${order.orderNumber}`}>{order.orderNumber}</Link>
              </>
            ) : null}
          </p>
        </div>
        <StatusBadge
          status={ticket.status}
          label={SUPPORT_STATUS_LABELS[ticket.status as SupportStatus] ?? ticket.status}
        />
      </div>

      <section className="card form" aria-labelledby="support-conversation-title">
        <h2 id="support-conversation-title">Conversation</h2>
        <ol className="timeline">
          {ticket.messages.map((message) => (
            <li key={message.id} className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <strong>{message.authorType === "staff" ? "Support team" : "You"}</strong>
                <p>{message.body}</p>
                <span className="small muted">{formatDate(message.createdAt)}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {ticket.status === "closed" ? (
        <div className="callout callout-warning section-tight">
          <p>
            This ticket is closed. Open a new ticket if you need help with a new request.
          </p>
        </div>
      ) : (
        <div className="section-tight">
          <ReplySupportTicketForm ticketId={ticket.id} />
        </div>
      )}

      <div className="hero-actions section-tight">
        <Link className="button button-secondary" href="/portal/support">
          All conversations
        </Link>
      </div>
    </>
  );
}
