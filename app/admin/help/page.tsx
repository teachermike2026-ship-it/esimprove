import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";

export const metadata = {
  title: "Operator help",
  robots: { index: false, follow: false },
};

const operatorTasks = [
  {
    task: "Review orders and fulfillment",
    where: "/admin/orders",
    note: "Order detail shows mock payments, jobs, and emails. Retry controls require orders.write.",
  },
  {
    task: "Approve refund requests",
    where: "/admin/refunds",
    note: "Administrator-only. Finance and support roles see a read-only view.",
  },
  {
    task: "Answer support tickets",
    where: "/admin/support",
    note: "Requires support.read. Contact-form submissions appear here.",
  },
  {
    task: "Review analytics",
    where: "/admin/analytics",
    note: "Administrator-only, first-party analytics. GA4 stays disabled unless consent and a measurement ID are configured.",
  },
  {
    task: "Manage retention and legal records",
    where: "/admin/legal",
    note: "Administrator-only. Retention periods are proposals until the owner confirms them.",
  },
  {
    task: "Publish articles and SEO settings",
    where: "/admin/blog",
    note: "Administrator-only content tools. Blog bodies are sanitized before storage.",
  },
  {
    task: "Check system health",
    where: "/admin/monitoring",
    note: "Administrator-only view of database, configuration, and job signals.",
  },
];

export default async function AdminHelpPage() {
  await requireStaff("/admin/help", "help");

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operator reference</p>
          <h1>Help center</h1>
          <p className="muted">
            Read-only guidance for this build. Customer-facing answers live in the public legal
            FAQ and guides; neither is edited from the operator console.
          </p>
        </div>
      </div>

      <section className="card form section-tight" aria-labelledby="operator-tasks">
        <h2 id="operator-tasks">Operator tasks</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Where</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {operatorTasks.map((entry) => (
                <tr key={entry.task}>
                  <td>{entry.task}</td>
                  <td>
                    <Link href={entry.where}>{entry.where}</Link>
                  </td>
                  <td>{entry.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card form section-tight" aria-labelledby="customer-help">
        <h2 id="customer-help">Customer-facing help</h2>
        <ul className="simple-list">
          <li>
            Legal and service FAQ: <Link href="/legal/faq">/legal/faq</Link>
          </li>
          <li>
            Travel and setup guides: <Link href="/guides">/guides</Link>
          </li>
          <li>
            Privacy request form: <Link href="/privacy/request">/privacy/request</Link>
          </li>
          <li>
            Contact and support: <Link href="/contact">/contact</Link>
          </li>
        </ul>
        <p className="muted small">
          The FAQ and guide copy is maintained in the application source. This build has no
          database-backed FAQ editor, so this page does not offer one.
        </p>
      </section>

      <section className="card form section-tight" aria-labelledby="current-limits">
        <h2 id="current-limits">Current limitations</h2>
        <ul className="simple-list">
          <li>Payments, supplier fulfillment, and email delivery are mock adapters.</li>
          <li>No live payment, supplier, email, or analytics integration is enabled.</li>
          <li>Legal documents are drafts pending owner and legal review.</li>
          <li>
            Customer accounts, orders, consent evidence, and analytics are stored in the local
            database used by this instance.
          </li>
        </ul>
        <p className="muted small">
          Deployment and live-integration work remains owner-controlled. See the project reports
          for the outstanding external approvals.
        </p>
      </section>
    </>
  );
}
