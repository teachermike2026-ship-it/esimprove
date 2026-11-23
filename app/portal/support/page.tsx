import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listSupportTicketViewsForUser, SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS, type SupportCategory, type SupportStatus } from "@/lib/support";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { CreateSupportTicketForm } from "@/components/support-forms";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function PortalSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await requireUser("/portal/support");
  const { order } = await searchParams;
  const db = await getDb();
  const tickets = await listSupportTicketViewsForUser(db, user.id);

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/portal">Portal</Link>
          </li>
          <li aria-current="page">Support</li>
        </ol>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customer support</p>
          <h1>Your support conversations</h1>
          <p className="muted">
            Open a ticket or follow an existing conversation. Our support team will respond as
            soon as possible.
          </p>
        </div>
      </div>

      <div className="split">
        <section className="stack">
          <h2>Conversations</h2>
          {tickets.length === 0 ? (
            <div className="card form">
              <p className="muted">
                No support tickets yet. Use the form to ask our support team a question.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Ticket</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Open</th>
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
                      <td>
                        {SUPPORT_CATEGORY_LABELS[ticket.category as SupportCategory] ??
                          ticket.category}
                      </td>
                      <td>
                        <StatusBadge
                          status={ticket.status}
                          label={SUPPORT_STATUS_LABELS[ticket.status as SupportStatus] ?? ticket.status}
                        />
                      </td>
                      <td>{formatDate(ticket.updatedAt)}</td>
                      <td>
                        <Link
                          className="button button-ghost button-small"
                          href={`/portal/support/${ticket.id}`}
                        >
                          Open <ArrowRight className="inline-icon" />
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
            <h2>Urgent account security issue?</h2>
            <p className="muted small">
              Change your password from the profile page and contact support with your order
              number. Never send your password or one-time codes in a ticket.
            </p>
            <Link className="button button-secondary" href="/portal/profile">
              Open profile
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
