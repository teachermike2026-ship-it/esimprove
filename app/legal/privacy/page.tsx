import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { loadLegalSettings } from "@/lib/legal";
import { listRetentionSettings } from "@/lib/legal-assets";
import {
  BusinessDetails,
  LegalDocumentFooter,
  LegalDocumentHeader,
  PrivacyContact,
  SupportChannelNotice,
} from "@/components/legal-document";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Esimprove handles account, order, support, consent, and first-party analytics data. Draft requiring owner details and legal review.",
  alternates: { canonical: "/legal/privacy" },
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const db = await getDb();
  const settings = await loadLegalSettings(db);
  const retention = await listRetentionSettings(db);

  return (
    <div className="legal-page">
      <LegalDocumentHeader
        settings={settings}
        documentKey="privacy"
        title="Privacy policy"
        intro="This policy explains what personal information the Esimprove application collects, why it is collected, how long it is kept, who processes it, and how to exercise privacy rights. It reflects the functionality in this build, including demo payments, disabled email delivery, and consent-gated first-party analytics."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="privacy-who">
          <h2 id="privacy-who">1. Who is responsible for your information</h2>
          <p>
            The website is operated by the business identified in the business details below.
            Where no verified legal entity is shown, this is a demonstration build and the
            controller identity is not yet configured.
          </p>
          <p>
            The privacy contact for this site is{" "}
            {settings.privacyContact ? (
              <a href={`mailto:${settings.privacyContact}`}>{settings.privacyContact}</a>
            ) : (
              "not configured yet"
            )}
            . Do not send passwords, one-time codes, or full payment card numbers.
          </p>
        </section>

        <section aria-labelledby="privacy-scope">
          <h2 id="privacy-scope">2. Scope and intended audience</h2>
          <p>
            This site is intended for people who can enter a binding contract and are old enough
            to use a travel connectivity service in their country. It is not directed at
            children. The owner has not yet approved a minimum age; no date of birth is
            collected. If you are below the age of majority where you live, use the service only
            with a parent or guardian&apos;s agreement.
          </p>
          <p>
            The site can be reached from multiple countries. The applicable jurisdiction and
            mandatory local protections still require owner and legal confirmation.
          </p>
        </section>

        <section aria-labelledby="privacy-collect">
          <h2 id="privacy-collect">3. Information we collect</h2>
          <h3>Account and registration information</h3>
          <ul>
            <li>Your name, email address, and password hash. Passwords are hashed, not stored in plain text.</li>
            <li>Account role, account creation time, and whether email verification has occurred. Email verification is not implemented, so addresses are not marked verified.</li>
            <li>If administrator 2FA is enabled, an encrypted TOTP secret and 2FA status. Authentication codes are verified, not stored.</li>
            <li>Consent records for Terms, Privacy Policy, age/capacity confirmation, and optional marketing, including purpose, document version, decision, timestamp, and a keyed hash of the network address for account consents. The raw address is not stored.</li>
          </ul>

          <h3>Order and transaction information</h3>
          <ul>
            <li>Order email, customer name, country of residence, plan, data allowance, validity, quantity, currency, prices, tax calculation, order status, and timestamps.</li>
            <li>Mock payment records: amount, currency, provider label, status, and signed webhook events. This build does not request or store card numbers, CVV codes, or bank credentials.</li>
            <li>Invoices, refunds, fulfilment jobs, and order status history needed to operate and evidence the transaction.</li>
          </ul>

          <h3>Support and contact information</h3>
          <ul>
            <li>Name, email address, subject, message, and related order reference when you submit a contact or support request.</li>
            <li>Support ticket status and messages. No live support inbox or external helpdesk is connected in this build.</li>
          </ul>

          <h3>Privacy and deletion requests</h3>
          <ul>
            <li>Request type, name, email, details, request reference, status, identity-verification state, administrative notes, and outcome.</li>
            <li>Verification tokens are stored only as hashes. Financial records that must be retained are not automatically deleted.</li>
          </ul>

          <h3>Website usage and analytics data</h3>
          <p>
            Optional first-party analytics is collected only after analytics consent and after
            the server confirms a current consent record. The payload contains pseudonymous
            visitor and session identifiers generated in the browser. The server stores HMAC
            hashes of those identifiers, not the raw identifiers. Analytics records may include
            page path, page title, event type, device class, browser family, operating-system
            family, coarse country code from hosting headers, referrer host/source, and internal
            or bot flags. Raw IP addresses, raw user-agent strings, advertising identifiers, and
            cross-site profiles are not stored. The browser&apos;s Do Not Track and Global
            Privacy Control signals suppress collection.
          </p>

          <h3>Cookies and similar storage</h3>
          <p>
            Essential cookies keep you signed in and preserve your cart. Local storage records
            your consent choice and a pseudonymous consent id; session storage holds an analytics
            session id when analytics is allowed. Optional GA4 is loaded only if the owner
            configures it and you grant analytics consent. See the{" "}
            <Link href="/legal/cookies">Cookie policy</Link> for durations and withdrawal.
          </p>

          <h3>Security, fraud-prevention, and audit data</h3>
          <ul>
            <li>Session token hashes, session expiry, coarse authentication metadata, and a keyed hash of the network address for rate limiting.</li>
            <li>Audit records for sign-in, administrative actions, consent review, privacy-request handling, and other security-relevant events. Secrets and passwords are not written to audit metadata.</li>
          </ul>

          <h3>Email marketing status</h3>
          <p>
            If you choose optional marketing, the site stores your email, subscription status,
            consent version, source, and an unsubscribe-token hash. Email sending is disabled in
            this build. Transactional order email is separate from optional marketing and is
            also disabled in the demo.
          </p>
          <p>
            We do not ask for your date of birth, government identity documents, precise
            location, contacts, health data, or biometric data through this website.
          </p>
        </section>

        <section aria-labelledby="privacy-why">
          <h2 id="privacy-why">4. Why we use information and the legal basis</h2>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">
                Categories of processing and their purposes and legal bases
              </caption>
              <thead>
                <tr>
                  <th scope="col">Processing</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Legal basis (requires legal confirmation)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Account and authentication</td>
                  <td>Create and secure your account, sign in, prevent abuse</td>
                  <td>Performance of a contract; security and legitimate interests</td>
                </tr>
                <tr>
                  <td>Orders, payments, fulfilment, invoices</td>
                  <td>Process and evidence a purchase, provide support, meet recordkeeping duties</td>
                  <td>Contract; legal obligation; legitimate interests</td>
                </tr>
                <tr>
                  <td>Support and contact records</td>
                  <td>Answer requests, investigate problems, manage disputes</td>
                  <td>Contract; legitimate interests; consent where required</td>
                </tr>
                <tr>
                  <td>First-party analytics</td>
                  <td>Understand aggregate site usage and improve the storefront</td>
                  <td>Consent, which can be withdrawn</td>
                </tr>
                <tr>
                  <td>Optional GA4</td>
                  <td>Traffic measurement if the owner configures it</td>
                  <td>Consent, which can be withdrawn</td>
                </tr>
                <tr>
                  <td>Optional marketing email</td>
                  <td>Send product and travel updates</td>
                  <td>Consent; separate unsubscribe available</td>
                </tr>
                <tr>
                  <td>Security, fraud prevention, audit</td>
                  <td>Protect accounts, investigate abuse, evidence administrative actions</td>
                  <td>Legitimate interests; legal obligation where applicable</td>
                </tr>
                <tr>
                  <td>Privacy request handling</td>
                  <td>Verify identity, respond to rights requests, retain accountability evidence</td>
                  <td>Legal obligation; legitimate interests</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small muted">
            This table describes intended bases. It is not a legal conclusion. A qualified lawyer
            must confirm the applicable bases and any jurisdiction-specific requirements.
          </p>
        </section>

        <section aria-labelledby="privacy-cookies">
          <h2 id="privacy-cookies">5. Cookies, consent, and analytics choices</h2>
          <p>
            Essential storage is used for sign-in sessions, cart continuity, security, and
            storing your consent decision. Optional analytics is off until you choose
            &quot;Accept all&quot; or enable analytics in the preference manager. A missing or
            outdated consent value is never treated as consent. You can reopen cookie settings
            from the footer, reject non-essential storage, customise categories, or withdraw
            consent at any time.
          </p>
          <p>
            Withdrawal stops first-party analytics collection and disables GA4 for this browser
            where it was configured. It does not delete analytics records that were lawfully
            collected before withdrawal; those records follow the retention table below.
          </p>
        </section>

        <section aria-labelledby="privacy-sharing">
          <h2 id="privacy-sharing">6. Sharing and third-party processors</h2>
          <p>
            Data may be processed by the production hosting provider, a PostgreSQL database
            provider selected by the owner, and, only with consent, Google Analytics 4 if the
            owner configures it. A live payment processor, eSIM supplier, and email provider are
            not configured in this build. No data is sold, and no advertising or marketing
            pixels are installed.
          </p>
          <p>
            Processors receive only the data needed for their function and are expected to be
            bound by written data-processing terms. The owner must complete contracts, verify
            security measures, and document international transfer mechanisms before production.
          </p>
          <p>
            Data may also be disclosed where required by law, to protect legal rights, to
            investigate fraud or abuse, or as part of a business transfer subject to applicable
            safeguards. The production inventory and transfer position are maintained in the
            admin Legal &amp; Compliance section.
          </p>
        </section>

        <section aria-labelledby="privacy-international">
          <h2 id="privacy-international">7. International transfers</h2>
          <p>
            The demo runs locally on the owner&apos;s machine. In production, hosting, database,
            GA4, payment, supplier, and email providers may process data in other countries. The
            exact countries and transfer mechanism depend on the providers the owner selects and
            are not configured or legally assessed in this build. Where required, the owner must
            use an approved transfer mechanism and assess local law.
          </p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">8. How long we keep information</h2>
          <p>
            The table below reflects the retention settings recorded in the application. Entries
            marked as proposed are operational defaults awaiting owner and legal approval; they
            are not statutory conclusions. Automated cleanup is active only where the setting is
            enabled.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Data categories and retention settings</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Recorded retention</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {retention.map((row) => (
                  <tr key={row.dataKey}>
                    <td>{row.label}</td>
                    <td>
                      {row.retentionDays === null
                        ? "Owner decision required"
                        : `${row.retentionDays} days`}
                    </td>
                    <td>
                      {row.enabled
                        ? "Configured; cleanup active where implemented"
                        : "Proposed — owner approval required"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Financial, transaction, fraud-prevention, and audit records may be kept for longer
            where the law requires it. A deletion request therefore anonymises the account
            profile but does not automatically erase orders, invoices, payments, refunds, or
            audit evidence. The admin workflow records the reason and retained categories.
          </p>
        </section>

        <section aria-labelledby="privacy-security">
          <h2 id="privacy-security">9. Security</h2>
          <p>
            Implemented measures include password hashing, encrypted administrator TOTP secrets,
            hashed session tokens, server-side authorization, HMAC identifiers for analytics and
            rate limiting, consent evidence checks before analytics collection, signed mock
            payment webhooks, audit logging, and a rule that payment card data is never collected.
            No system is perfectly secure. The owner must complete a production security review,
            key management, backups, monitoring, access review, and incident-response process.
          </p>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">10. Your privacy rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, delete, restrict,
            object to processing, receive a portable copy, withdraw consent, and complain to a
            supervisory authority. These rights are not absolute and may be limited by legal
            recordkeeping or other obligations.
          </p>
          <p>
            Submit a request through the <Link href="/privacy/request">privacy request form</Link>{" "}
            or contact the privacy address above. You will receive a reference ID. Requests that
            could delete an account require identity verification. An unauthenticated request
            containing an email address is never sufficient to delete an account.
          </p>
          <p>
            We will not charge a fee for a routine request unless the law permits it. Complex or
            repetitive requests may require an extension or a fee where allowed. If a request is
            refused, the response will explain why and any available complaint route.
          </p>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2 id="privacy-changes">11. Changes to this policy</h2>
          <p>
            The version and effective date are shown above. Material changes will require a new
            version, a new consent record where consent is the basis, and appropriate notice.
            Do not rely on a draft version as a final legal policy.
          </p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact">12. Contact</h2>
          <p>
            Use the privacy contact above or the{" "}
            <Link href="/contact">contact page</Link> for general questions. No live support
            inbox, telephone line, or response-time promise is connected in this build.
          </p>
        </section>
      </article>

      <BusinessDetails settings={settings} />
      <PrivacyContact settings={settings} />
      <SupportChannelNotice settings={settings} />
      <LegalDocumentFooter settings={settings} documentKey="privacy" />
    </div>
  );
}
