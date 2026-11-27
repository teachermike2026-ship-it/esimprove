import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  allowedTestRecipients,
  emailDiagnostics,
  isTestTemplateKey,
  listEmailLog,
  renderTestTemplate,
  TEST_TEMPLATES,
  type TestTemplateKey,
} from "@/lib/email-ops";
import { sendTestEmailAction } from "@/app/admin/ops-actions";
import { formatDate } from "@/lib/money";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Email Center",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <li>
      {ok ? <CheckIcon className="inline-icon" /> : <AlertIcon className="inline-icon" />} <strong>{label}</strong>
      {detail ? <span className="muted small"> · {detail}</span> : null}
    </li>
  );
}

export default async function EmailCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; test?: string; id?: string; error?: string }>;
}) {
  await requireStaff("/admin/emails", "emails");
  const params = await searchParams;
  const admin = await getCurrentUser();
  const db = await getDb();
  const [diag, log] = await Promise.all([emailDiagnostics(db), listEmailLog(db, 100)]);
  const previewKey: TestTemplateKey = params.preview && isTestTemplateKey(params.preview) ? params.preview : "order.confirmation";
  const preview = renderTestTemplate(previewKey);
  const recipients = admin ? allowedTestRecipients(admin.email) : [];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Communication</p>
          <h1>Email Center</h1>
          <p className="muted">
            Resend configuration, delivery log and test sends. The API key is never shown. Email never blocks payment,
            fulfillment or the QR code on the order page.
          </p>
        </div>
      </div>

      {params.test === "sent" ? (
        <div className="callout callout-success section-tight" role="status">
          <CheckIcon className="inline-icon" />
          <p>Test email accepted by Resend. Message ID: {params.id}</p>
        </div>
      ) : null}
      {params.test === "failed" ? (
        <div className="callout callout-warning section-tight" role="alert">
          <AlertIcon className="inline-icon" />
          <p>Test email not sent: {params.error}</p>
        </div>
      ) : null}

      <div className="inline-grid two">
        <section className="card form">
          <h2>Configuration diagnostics</h2>
          <ul className="check-list">
            <Check ok={diag.apiKeyPresent} label="RESEND_API_KEY" detail={diag.apiKeyPresent ? (diag.apiKeyFormatValid ? "set, format re_…" : "set, unexpected format") : "missing"} />
            <Check ok={diag.resend.status === "ok"} label="Resend authentication" detail={diag.resend.message} />
            <Check
              ok={diag.resend.senderDomainVerified}
              label="Sender domain"
              detail={
                diag.resend.senderDomain
                  ? `${diag.resend.senderDomain}: ${diag.resend.senderDomainVerified === null ? "not checked" : diag.resend.senderDomainVerified ? "verified" : "not verified in Resend"}`
                  : "EMAIL_FROM has no address"
              }
            />
            <Check ok={Boolean(diag.emailFrom)} label="EMAIL_FROM" detail={diag.emailFrom ?? "missing"} />
            <Check ok={diag.emailProvider === "resend"} label="EMAIL_PROVIDER" detail={diag.emailProvider} />
            <Check
              ok={diag.emailLiveEnabled && diag.liveProblems.length === 0}
              label="EMAIL_LIVE_ENABLED"
              detail={
                diag.emailLiveEnabled
                  ? diag.liveProblems.length === 0
                    ? "on: customer emails are sent"
                    : `on but incomplete: ${diag.liveProblems.join("; ")}`
                  : "off: customer emails are only logged"
              }
            />
          </ul>
          <p className="form-note">
            Resend checked {formatDate(diag.resend.checkedAt)} (read-only domain list, cached for 1 minute).
            {diag.resend.domains.length > 0
              ? ` Domains: ${diag.resend.domains.map((d) => `${d.name} (${d.status})`).join(", ")}.`
              : ""}
          </p>
        </section>

        <section className="card form">
          <h2>Last 7 days</h2>
          <ul className="check-list">
            <li>
              Sent by Resend: <strong>{diag.last7Days.sent ?? 0}</strong>
            </li>
            <li>
              Logged only (email off): <strong>{diag.last7Days.logged ?? 0}</strong>
            </li>
            <li>
              Failed: <strong>{diag.last7Days.failed ?? 0}</strong>
            </li>
          </ul>
          <p className="muted small">
            Last successful send: {diag.lastSuccessfulSend?.sentAt ? formatDate(diag.lastSuccessfulSend.sentAt) : "none recorded"}
          </p>
        </section>
      </div>

      <section className="card form section-tight" aria-labelledby="email-testing-title">
        <h2 id="email-testing-title">
          <MailIcon className="inline-icon" /> Email Testing
        </h2>
        <p className="muted small">
          Preview a template with sample data, then send one real test email to an administrator-controlled address.
          Test emails never use customer data.
        </p>
        <form className="pill-row" action="/admin/emails">
          <label className="small" htmlFor="preview-template">
            Template
          </label>
          <select id="preview-template" name="preview" defaultValue={previewKey}>
            {Object.entries(TEST_TEMPLATES).map(([key, t]) => (
              <option key={key} value={key}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="button button-small button-secondary" type="submit">
            Preview
          </button>
        </form>
        <div className="card section-tight">
          <p className="small">
            <strong>Subject:</strong> {preview.subject}
          </p>
          <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {preview.text}
          </pre>
        </div>
        <p className="form-note">
          eSIM delivery emails are not previewed with fake codes: use “Resend delivery email” on a delivered order, which
          uses that order&apos;s real eSIM. Payment-confirmation and failed-order templates do not exist yet.
        </p>

        <form action={sendTestEmailAction} className="form section-tight">
          <input type="hidden" name="template" value={previewKey} />
          <div className="field">
            <label htmlFor="test-recipient">Send this template to</label>
            {recipients.length > 0 ? (
              <select id="test-recipient" name="recipient" required>
                {recipients.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            ) : (
              <p className="muted small">No administrator-controlled recipient is available.</p>
            )}
            <p className="form-note">
              Only your own admin email{diag.testRecipientConfigured ? " or EMAIL_TEST_RECIPIENT" : ""} can receive test emails.
            </p>
          </div>
          <label className="checkbox">
            <input type="checkbox" name="confirm" value="yes" required />
            <span>I understand this sends one real email through Resend.</span>
          </label>
          <button className="button button-small" type="submit" disabled={recipients.length === 0 || !diag.apiKeyPresent}>
            <MailIcon className="inline-icon" /> Send test email
          </button>
        </form>
      </section>

      <section className="card form section-tight">
        <h2>Delivery log</h2>
        {log.length === 0 ? (
          <p className="muted">No emails recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Template</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Resend ID / response</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id}>
                    <td className="small">{formatDate(row.createdAt)}</td>
                    <td className="small">{row.template}</td>
                    <td className="small">{row.recipientMasked}</td>
                    <td>
                      <span className={`badge ${row.status === "sent" ? "badge-success" : row.status === "failed" ? "badge-danger" : "badge-neutral"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="small">{row.providerMessageId ?? row.providerResponse ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="form-note">
          Failed eSIM delivery emails can be re-sent from the order page after confirmation. Bodies are stored with
          activation codes and access links redacted.
        </p>
      </section>
    </>
  );
}
