import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { supportTickets, supportMessages, users, orders } from "@/lib/db/schema";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";

export const metadata = {
  title: "Admin support",
  robots: { index: false, follow: false },
};

export default async function AdminSupportPage() {
  await requireStaff("/admin/support", "support");
  const db = await getDb();
  const [ticketRows, messageRows, userRows, orderRows] = await Promise.all([
    db.select().from(supportTickets).orderBy(supportTickets.createdAt).limit(100),
    db.select().from(supportMessages).orderBy(supportMessages.createdAt),
    db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users),
    db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders),
  ]);

  const userById = new Map(userRows.map((u) => [u.id, u]));
  const orderById = new Map(orderRows.map((o) => [o.id, o]));

  const messagesByTicket = new Map<string, typeof messageRows>();
  for (const msg of messageRows) {
    const arr = messagesByTicket.get(msg.ticketId) ?? [];
    arr.push(msg);
    messagesByTicket.set(msg.ticketId, arr);
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Support</p>
          <h1>Customer support</h1>
          <p className="muted">Support tickets, messages, and contact system.</p>
        </div>
      </div>

      <section className="card form section-tight">
        <h2>Support tickets</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Customer</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {ticketRows.map((ticket) => {
                const user = ticket.userId ? userById.get(ticket.userId) : null;
                const order = ticket.orderId ? orderById.get(ticket.orderId) : null;
                return (
                  <tr key={ticket.id}>
                    <td>
                      <strong>{ticket.id}</strong>
                      <br />
                      <span className="small muted">{ticket.subject}</span>
                      {order ? (
                        <>
                          <br />
                          <span className="small muted">Order {order.orderNumber}</span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {user ? (
                        <>
                          <strong>{user.name ?? "—"}</strong>
                          <br />
                          <span className="small muted">{user.email ?? "—"}</span>
                        </>
                      ) : ticket.requesterEmail ? (
                        <>
                          <strong>Contact form</strong>
                          <br />
                          <span className="small muted">{ticket.requesterEmail}</span>
                        </>
                      ) : (
                        <span className="small muted">Unknown / not registered</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-warning">{ticket.priority}</span>
                    </td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>{formatDate(ticket.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card form section-tight">
        <h2>Contact system</h2>
        <p className="muted">
          Demo mode: contact form submissions are not processed automatically. 
          Real implementation requires email service integration.
        </p>
        <p className="muted small">
          Fields: Name, Email, Subject, Message. Attachments (optional) are not processed in demo.
        </p>
      </section>

      <section className="card form section-tight">
        <h2>Ticket categories (reference)</h2>
        <ul className="simple-list">
          <li>Payment</li>
          <li>Installation</li>
          <li>Activation</li>
          <li>Compatibility</li>
          <li>Coverage</li>
          <li>Data usage</li>
          <li>Top-up</li>
          <li>Refund</li>
          <li>Delivery delay</li>
          <li>Technical issue</li>
        </ul>
      </section>

      <section className="card form section-tight">
        <h2>Message history</h2>
        {ticketRows.length === 0 ? (
          <p className="muted">No support tickets have been created.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Author type</th>
                  <th scope="col">Message</th>
                  <th scope="col">At</th>
                </tr>
              </thead>
              <tbody>
                {ticketRows.map((ticket) => {
                  const msgs = messagesByTicket.get(ticket.id) ?? [];
                  return msgs.map((msg) => (
                    <tr key={msg.id}>
                      <td>
                        <strong>{ticket.id}</strong>
                        <br />
                        <span className="small muted">{ticket.subject}</span>
                      </td>
                      <td>{msg.authorType}</td>
                      <td>{msg.body}</td>
                      <td>{formatDate(msg.createdAt)}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}