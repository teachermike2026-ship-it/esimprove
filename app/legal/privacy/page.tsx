import type { Metadata } from "next";
import { AlertIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Privacy draft",
  description: "Draft privacy notes for the eSIMprove demonstration storefront.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="card form prose">
      <span className="badge badge-demo">Draft — not legal advice</span>
      <h1>Privacy draft</h1>
      <div className="callout callout-warning">
        <AlertIcon className="inline-icon" />
        <p>
          This is a technical description of the demo, not a privacy notice for a live service.
          Retention periods, lawful bases, processors, international transfers, and data-subject
          request procedures have not been decided.
        </p>
      </div>
      <h2>What the demo stores locally</h2>
      <ul>
        <li>Cart contents, order details, and the email address you enter at demo checkout.</li>
        <li>Hashed passwords and database-backed session records for demo accounts.</li>
        <li>Mock activation data encrypted with envelope encryption.</li>
        <li>Order events, audit events, and a local mock email log with redacted access tokens.</li>
        <li>Hashed IP identifiers for rate limiting and activation-access auditing.</li>
      </ul>
      <h2>What it does not do</h2>
      <ul>
        <li>It does not send real email or contact a real supplier.</li>
        <li>It does not process real payments or collect card numbers.</li>
        <li>It does not include analytics, advertising pixels, or third-party tracking.</li>
      </ul>
      <h2>Retention and deletion</h2>
      <p>
        The local demo database persists until you remove it. There is no automated retention
        schedule or self-service deletion workflow. A production service needs documented
        retention, deletion, export, and request-handling procedures.
      </p>
      <h2>Contact</h2>
      <p>
        No privacy contact, data protection officer, representative, or supervisory authority
        has been configured. These are owner decisions before launch.
      </p>
    </article>
  );
}
