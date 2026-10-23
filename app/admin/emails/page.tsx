import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { listAdminEmails } from "@/lib/admin";
import { formatDate } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { MailIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Email log",
  robots: { index: false, follow: false },
};

export default async function AdminEmailsPage() {
  await requireAdmin();
  const db = await getDb();
  const emails = await listAdminEmails(db, 200);

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Mock delivery</p>
          <h1>Email log</h1>
          <p className="muted">
            The mock transport logs messages locally. The stored body redacts the order access
            token. No real email is sent.
          </p>
        </div>
        <span className="badge badge-demo">
          <MailIcon className="inline-icon" /> Local logger
        </span>
      </div>

      {emails.length === 0 ? (
        <div className="card form">
          <p className="muted">No email events yet.</p>
        </div>
      ) : (
        <div className="stack">
          {emails.map(({ email, orderNumber }) => (
            <details key={email.id} className="card form email-event">
              <summary>
                <span>
                  <strong>{email.subject}</strong>
                  <br />
                  <span className="small muted">
                    {email.recipient} · {formatDate(email.createdAt)}
                    {orderNumber ? ` · ${orderNumber}` : ""}
                  </span>
                </span>
                <StatusBadge status={email.status} />
              </summary>
              <p className="small muted">
                Template: {email.template}
                {orderNumber ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/admin/orders/${orderNumber}`}>Open order</Link>
                  </>
                ) : null}
              </p>
              <pre>{email.bodyText}</pre>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
