import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { findSubscriptionByUnsubscribeToken } from "@/lib/email-subscriptions";
import { unsubscribeAction } from "./actions";
import { AlertIcon, CheckIcon, LockIcon, MailIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Confirm an email marketing unsubscribe request.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "the subscribed address";
  return `${local.slice(0, 1)}${"*".repeat(Math.min(Math.max(local.length - 1, 3), 8))}@${domain}`;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const flags = await searchParams;
  const token = typeof flags.token === "string" ? flags.token.trim() : "";
  const db = token ? await getDb() : null;
  const subscription =
    db && token && token.length <= 200
      ? await findSubscriptionByUnsubscribeToken(db, token)
      : null;
  const done = flags.done === "1";
  const invalid = !token || flags.error === "missing" || flags.error === "invalid" || !subscription;
  const alreadyUnsubscribed = subscription?.status === "unsubscribed";

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">Email preferences</p>
        <h1>Unsubscribe from marketing email</h1>
        <p className="lead">
          Confirm that you want to stop optional marketing email. Transactional messages about an
          order, security, or a privacy request are separate.
        </p>
      </header>

      {done ? (
        <div className="callout callout-success" role="status">
          <CheckIcon className="inline-icon" />
          <div>
            <p>
              <strong>You are unsubscribed.</strong> Optional marketing email is now disabled for
              this address.
            </p>
            <p className="small">
              No further marketing email will be sent to this address. You may still receive
              transactional messages about your orders and account.
            </p>
          </div>
        </div>
      ) : invalid ? (
        <div className="callout callout-warning" role="alert">
          <AlertIcon className="inline-icon" />
          <div>
            <p>
              <strong>This unsubscribe link is not valid.</strong> The token may be incomplete,
              already used, or expired.
            </p>
            <p className="small">
              You can use the <Link href="/contact">contact page</Link> to ask us to stop marketing
              email, or the <Link href="/privacy/request">privacy request form</Link> if your
              concern is about personal data.
            </p>
          </div>
        </div>
      ) : alreadyUnsubscribed ? (
        <div className="callout" role="status">
          <CheckIcon className="inline-icon" />
          <div>
            <p>
              <strong>This address is already unsubscribed.</strong> No further action is needed.
            </p>
            {subscription.unsubscribedAt ? (
              <p className="small">
                Recorded on{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "UTC",
                }).format(subscription.unsubscribedAt)}{" "}
                (UTC).
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <section className="card form" aria-labelledby="unsubscribe-confirm-title">
          <h2 id="unsubscribe-confirm-title">Confirm unsubscribe</h2>
          <p>
            <MailIcon className="inline-icon" /> Address:{" "}
            <strong>{maskEmail(subscription.email)}</strong>
          </p>
          <p>
            This action changes the marketing subscription status immediately. It does not delete
            your account, order records, or privacy-request records. See the{" "}
            <Link href="/legal/privacy">Privacy Policy</Link> for retention information.
          </p>
          <form action={unsubscribeAction}>
            <input type="hidden" name="token" value={token} />
            <button className="button button-danger" type="submit">
              <LockIcon className="inline-icon" />
              Confirm unsubscribe
            </button>
          </form>
          <p className="form-note">
            Opening this page does not unsubscribe you. You must confirm with the button. This
            prevents email link scanners from changing your preference automatically.
          </p>
        </section>
      )}

      <section className="card form section-tight" aria-labelledby="unsubscribe-about-title">
        <h2 id="unsubscribe-about-title">What this preference covers</h2>
        <ul className="simple-list">
          <li>
            <strong>Optional marketing:</strong> product updates, travel tips, and promotional
            messages. This is controlled by consent.
          </li>
          <li>
            <strong>Transactional messages:</strong> order confirmation, payment status, security
            alerts, and a response to a privacy request. These are not marketing and are handled
            separately where a live provider exists.
          </li>
          <li>
            <strong>Privacy requests:</strong> use the{" "}
            <Link href="/privacy/request">privacy request form</Link> to access, correct, or delete
            personal data.
          </li>
        </ul>
        <p className="small muted">
          The unsubscribe token is stored only as a hash on the server. To change other email
          preferences, see your account profile.
        </p>
      </section>
    </div>
  );
}
