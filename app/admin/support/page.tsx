import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { orders, users } from "@/lib/db/schema";
import {
  listAllSupportTickets,
  listSupportAgents,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { adminReplySupportAction, adminUpdateSupportAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin support",
  robots: { index: false, follow: false },
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; replied?: string; updated?: string }>;
}) {
  const staff = await requireStaff("/admin/support", "support");
  const canWrite = hasPermission(staff.role, "support.write");
  const { error, replied, updated } = await searchParams;
  const db = await getDb();
  const [tickets, agents, userRows, orderRows] = await Promise.all([
    listAllSupportTickets(db, 100),
    listSupportAgents(db),
    db.select({ id: users.id, email: users.email, name: users.name }).from(users),
    db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders),
  ]);
  const userById = new Map(userRows.map((user) => [user.id, user]));
  const orderById = new Map(orderRows.map((order) => [order.id, order]));
  const openCount = tickets.filter((ticket) => ticket.status !== "closed" && ticket.status !== "resolved").length;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Support</p>
          <h1>Customer support</h1>
          <p className="muted">
            Read conversations, reply, assign an operator, and move tickets through the support
            lifecycle. Replies are local records; email notices use the configured transport.
          </p>
        </div>
        <span className="badge badge-demo">{openCount} active</span>
      </div>

      {replied === "1" ? (
        <div className="callout callout-success section-tight" role="status">
          <p>Reply recorded and the customer conversation was updated.</p>
        </div>
      ) : null}
      {updated === "1" ? (
        <div className="callout callout-success section-tight" role="status">
          <p>Ticket routing and status were updated.</p>
        </div>
      ) : null}
      {error ? (
        <div className="form-error section-tight" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {tickets.length === 0 ? (
        <div className="card form">
          <p className="muted">No support tickets have been created.</p>
        </div>
      ) : (
        <div className="stack">
          {tickets.map((ticket) => {
            const user = ticket.userId ? userById.get(ticket.userId) : null;
            const order = ticket.orderId ? orderById.get(ticket.orderId) : null;
            const assignee = ticket.assignedTo ? userById.get(ticket.assignedTo) : null;
            return (
              <section className="card form" key={ticket.id} aria-labelledby={`ticket-${ticket.id}`}>
                <div className="order-head">
                  <div>
                    <p className="eyebrow">
                      {SUPPORT_CATEGORY_LABELS[ticket.category as SupportCategory] ??
                        ticket.category}{" "}
                      · {ticket.id}
                    </p>
                    <h2 id={`ticket-${ticket.id}`}>{ticket.subject}</h2>
                    <div className="order-meta">
                      <span>{user?.name ?? "Contact form"}</span>
                      <span>{user?.email ?? ticket.requesterEmail ?? "No email"}</span>
                      <span>Updated {formatDate(ticket.updatedAt)}</span>
                      {order ? (
                        <span>
                          <Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link>
                        </span>
                      ) : null}
                      {assignee ? <span>Assigned to {assignee.name}</span> : <span>Unassigned</span>}
                    </div>
                  </div>
                  <div className="pill-row">
                    <StatusBadge
                      status={ticket.status}
                      label={SUPPORT_STATUS_LABELS[ticket.status as SupportStatus] ?? ticket.status}
                    />
                    <span className="badge badge-warning">
                      {SUPPORT_PRIORITY_LABELS[ticket.priority as SupportPriority] ?? ticket.priority}
                    </span>
                  </div>
                </div>

                <ol className="timeline">
                  {ticket.messages.map((message) => (
                    <li key={message.id} className="timeline-item">
                      <span className="timeline-dot" aria-hidden="true" />
                      <div>
                        <strong>{message.authorType === "staff" ? "Support team" : "Customer"}</strong>
                        <p>{message.body}</p>
                        <span className="small muted">{formatDate(message.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ol>

                {canWrite ? (
                  <div className="split section-tight">
                    <div className="stack-sm">
                      <h3>Reply</h3>
                      {ticket.status === "closed" ? (
                        <p className="muted small">
                          Reopen the ticket below before sending a reply.
                        </p>
                      ) : (
                        <form action={adminReplySupportAction} className="form">
                          <input type="hidden" name="ticketId" value={ticket.id} />
                          <div className="field">
                            <label htmlFor={`reply-${ticket.id}`}>Reply to customer</label>
                            <textarea
                              id={`reply-${ticket.id}`}
                              name="message"
                              rows={4}
                              required
                              maxLength={4000}
                            />
                          </div>
                          <button className="button button-small" type="submit">
                            Send reply
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="stack-sm">
                      <h3>Routing and status</h3>
                      <form action={adminUpdateSupportAction} className="form">
                        <input type="hidden" name="ticketId" value={ticket.id} />
                        <div className="field">
                          <label htmlFor={`status-${ticket.id}`}>Status</label>
                          <select
                            id={`status-${ticket.id}`}
                            name="status"
                            defaultValue={ticket.status}
                          >
                            {SUPPORT_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {SUPPORT_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`priority-${ticket.id}`}>Priority</label>
                          <select
                            id={`priority-${ticket.id}`}
                            name="priority"
                            defaultValue={ticket.priority}
                          >
                            {SUPPORT_PRIORITIES.map((priority) => (
                              <option key={priority} value={priority}>
                                {SUPPORT_PRIORITY_LABELS[priority]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`category-${ticket.id}`}>Category</label>
                          <select
                            id={`category-${ticket.id}`}
                            name="category"
                            defaultValue={ticket.category}
                          >
                            {SUPPORT_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {SUPPORT_CATEGORY_LABELS[category]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`assignee-${ticket.id}`}>Assignee</label>
                          <select
                            id={`assignee-${ticket.id}`}
                            name="assignedTo"
                            defaultValue={ticket.assignedTo ?? ""}
                          >
                            <option value="">Unassigned</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name} ({agent.role})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button className="button button-secondary button-small" type="submit">
                          Save routing
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="muted small">
                    Your role can read support conversations but cannot reply or change routing.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className="card form section-tight">
        <h2>Support model</h2>
        <p className="muted small">
          Categories: {SUPPORT_CATEGORIES.map((category) => SUPPORT_CATEGORY_LABELS[category]).join(", ")}.
          Customer replies move a ticket back to awaiting staff; staff replies move it to awaiting
          customer. Closing a ticket records the timestamp, and only an operator can reopen it.
        </p>
        <p className="muted small">
          Email notices in this build are mock/local. The admin console shows the authoritative
          conversation state stored in the database.
        </p>
      </section>
    </>
  );
}
