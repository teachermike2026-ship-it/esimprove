import type { Metadata } from "next";
import Link from "next/link";
import {
  BusinessDetails,
  LegalDocumentFooter,
  LegalDocumentHeader,
  PrivacyContact,
  SupportChannelNotice,
} from "@/components/legal-document";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/legal/privacy",
    title: t("legal.privacy"),
    description: t("legal.privacyDescription"),
  });
}

export default async function PrivacyPage() {
  const { t } = await getI18n();
  return (
    <div className="legal-page">
      <LegalDocumentHeader
        title={t("legal.privacy")}
        intro="This policy explains what personal information ESIMPROVE collects, why we collect it, how long we keep it, who processes it, and how you can exercise your privacy rights."
      />

      <article className="card form prose legal-body">
        <section aria-labelledby="privacy-who">
          <h2 id="privacy-who">1. Who is responsible for your information</h2>
          <p>
            ESIMPROVE is an online digital services platform and online brand operated from Vietnam,
            a provisional operating location. It is not a registered company and does not hold or
            claim a company registration number or VAT number. For the purposes of this policy,
            ESIMPROVE is the party responsible for the personal information described here.
          </p>
          <p>
            The privacy contact is{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Do not send
            passwords, one-time authentication codes, or full payment card numbers.
          </p>
        </section>

        <section aria-labelledby="privacy-scope">
          <h2 id="privacy-scope">2. Scope and intended audience</h2>
          <p>
            This site is intended for people who can enter a binding contract and who are old enough
            to use a travel connectivity service in their country. It is not directed at children,
            and we do not knowingly collect personal information from children. No date of birth is
            collected. If you are below the age of majority where you live, use the service only
            with a parent or guardian&apos;s agreement.
          </p>
          <p>
            The site can be reached from many countries. Mandatory consumer protection and privacy
            laws that apply in your country of residence are respected as described in section 10.
          </p>
        </section>

        <section aria-labelledby="privacy-collect">
          <h2 id="privacy-collect">3. Information we collect</h2>
          <h3>Account and registration information</h3>
          <ul>
            <li>Your name, email address, and password hash. Passwords are hashed, never stored in plain text.</li>
            <li>Account role, account creation time, and email verification status.</li>
            <li>If administrator two-factor authentication is enabled, an encrypted TOTP secret and 2FA status. Authentication codes are verified, not stored.</li>
            <li>Consent records for the Terms of Service, Privacy Policy, age or capacity confirmation, and optional marketing, including purpose, document version, decision, timestamp, and a keyed hash of the network address for account consents. The raw address is not stored.</li>
          </ul>

          <h3>Order and transaction information</h3>
          <ul>
            <li>Order email, customer name, country of residence, plan, data allowance, validity, quantity, currency, prices, tax calculation, order status, and timestamps.</li>
            <li>Payment records: amount, currency, provider label, status, and webhook events. Card numbers, CVV codes, and bank credentials are never requested or stored.</li>
            <li>Invoices, refunds, fulfilment records, and order status history needed to operate and evidence the transaction.</li>
          </ul>

          <h3>Support and contact information</h3>
          <ul>
            <li>Name, email address, subject, message, and related order reference when you contact support.</li>
            <li>Support ticket status and messages.</li>
          </ul>

          <h3>Privacy and deletion requests</h3>
          <ul>
            <li>Request type, name, email, details, request reference, status, identity-verification state, administrative notes, and outcome.</li>
            <li>Verification tokens are stored only as hashes. Financial records that must be retained are not automatically deleted.</li>
          </ul>

          <h3>Website usage and analytics data</h3>
          <p>
            Optional first-party analytics is collected only after you grant analytics consent and
            after the server confirms a current consent record. The payload contains pseudonymous
            visitor and session identifiers generated in the browser. The server stores HMAC hashes
            of those identifiers, not the raw identifiers. Analytics records may include page path,
            page title, event type, device class, browser family, operating-system family, coarse
            country code from hosting headers, referrer host or source, and internal or bot flags.
            Raw IP addresses, raw user-agent strings, advertising identifiers, and cross-site
            profiles are not stored. The browser&apos;s Do Not Track and Global Privacy Control
            signals suppress collection.
          </p>

          <h3>Cookies and similar storage</h3>
          <p>
            Essential cookies keep you signed in and preserve your cart. Local storage records your
            consent choice and a pseudonymous consent id; session storage holds an analytics
            session id when analytics is allowed. Google Analytics 4 loads only if it is configured
            for the site and you grant analytics consent. See the{" "}
            <Link href="/legal/cookies">Cookie policy</Link> for durations and withdrawal.
          </p>

          <h3>Security, fraud-prevention, and audit data</h3>
          <ul>
            <li>Session token hashes, session expiry, coarse authentication metadata, and a keyed hash of the network address for rate limiting.</li>
            <li>Audit records for sign-in, administrative actions, consent review, privacy-request handling, and other security-relevant events. Secrets and passwords are not written to audit metadata.</li>
          </ul>

          <h3>Email marketing status</h3>
          <p>
            If you opt in to optional marketing, we store your email, subscription status, consent
            version, source, and an unsubscribe-token hash. You can unsubscribe at any time.
            Transactional order email is separate from optional marketing.
          </p>
          <p>
            We do not ask for your date of birth, government identity documents, precise location,
            contacts, health data, or biometric data through this website.
          </p>
        </section>

        <section aria-labelledby="privacy-why">
          <h2 id="privacy-why">4. Why we use information and the legal bases</h2>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">
                Categories of processing, their purposes, and their legal bases
              </caption>
              <thead>
                <tr>
                  <th scope="col">Processing</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Legal basis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Account and authentication</td>
                  <td>Create and secure your account, sign in, prevent abuse</td>
                  <td>Performance of a contract; legitimate interests (security)</td>
                </tr>
                <tr>
                  <td>Orders, payments, fulfilment, invoices</td>
                  <td>Process and evidence a purchase, provide support, meet recordkeeping duties</td>
                  <td>Performance of a contract; legal obligation; legitimate interests</td>
                </tr>
                <tr>
                  <td>Support and contact records</td>
                  <td>Answer requests, investigate problems, manage disputes</td>
                  <td>Performance of a contract; legitimate interests</td>
                </tr>
                <tr>
                  <td>First-party analytics</td>
                  <td>Understand aggregate site usage and improve the service</td>
                  <td>Consent, which can be withdrawn at any time</td>
                </tr>
                <tr>
                  <td>Optional Google Analytics 4</td>
                  <td>Traffic measurement, where enabled</td>
                  <td>Consent, which can be withdrawn at any time</td>
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
        </section>

        <section aria-labelledby="privacy-cookies">
          <h2 id="privacy-cookies">5. Cookies, consent, and analytics choices</h2>
          <p>
            Essential storage is used for sign-in sessions, cart continuity, security, and storing
            your consent decision. Optional analytics is off until you choose &quot;Accept all&quot;
            or enable analytics in the preference manager. A missing or outdated consent value is
            never treated as consent. You can reopen cookie settings from the footer, reject
            non-essential storage, customise categories, or withdraw consent at any time.
          </p>
          <p>
            Withdrawal stops first-party analytics collection and disables Google Analytics for this
            browser where it is enabled. It does not delete analytics records that were lawfully
            collected before withdrawal; those records follow the retention section below.
          </p>
        </section>

        <section aria-labelledby="privacy-sharing">
          <h2 id="privacy-sharing">6. Sharing and third-party processors</h2>
          <p>
            Personal information may be processed by our hosting provider, our database provider,
            and, only with your consent, Google Analytics 4 if it is enabled for the site. Payment
            processing is handled by the payment provider shown at checkout; eSIM delivery depends
            on mobile network operators and eSIM suppliers.
          </p>
          <p>
            Processors receive only the data needed for their function and are expected to be bound
            by written data-processing terms. We do not sell personal information, and no
            advertising or marketing pixels are installed.
          </p>
          <p>
            Personal information may also be disclosed where required by law, to protect legal
            rights, to investigate fraud or abuse, or as part of a business transfer subject to
            applicable safeguards.
          </p>
        </section>

        <section aria-labelledby="privacy-international">
          <h2 id="privacy-international">7. International transfers</h2>
          <p>
            ESIMPROVE operates online from Vietnam, and the providers it uses to run the service
            may process data in other countries. Where required, appropriate safeguards for
            international transfers are used, such as contractual clauses approved for that purpose.
            If you would like more information about transfers relevant to your information, contact
            us at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
          </p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2 id="privacy-retention">8. How long we keep information</h2>
          <p>
            We keep personal information only as long as needed for the purposes described in this
            policy, or as required by law. Typical periods are:
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Data categories and typical retention</caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Typical retention</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Account and profile</td>
                  <td>While your account exists, plus any period required to resolve disputes or meet legal duties.</td>
                </tr>
                <tr>
                  <td>Order, payment, and invoice records</td>
                  <td>As required by tax, accounting, and financial recordkeeping law.</td>
                </tr>
                <tr>
                  <td>Support tickets</td>
                  <td>While needed to resolve your request, plus a reasonable period for quality and dispute handling.</td>
                </tr>
                <tr>
                  <td>Privacy request records</td>
                  <td>While needed to handle the request and evidence accountability.</td>
                </tr>
                <tr>
                  <td>Consent records</td>
                  <td>While needed to evidence your choice, or until the consent policy version is superseded.</td>
                </tr>
                <tr>
                  <td>First-party analytics</td>
                  <td>Pseudonymous and short-lived. Analytics consent is valid for at most 180 days before a fresh choice is required.</td>
                </tr>
                <tr>
                  <td>Session and rate-limit identifiers</td>
                  <td>Short-lived; only until the session or rate-limit window expires.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Financial, transaction, fraud-prevention, and audit records may be kept for longer where
            the law requires it. A deletion request therefore anonymises the account profile but
            does not automatically erase orders, invoices, payments, refunds, or audit evidence. The
            reason for retention of specific categories is recorded in the handling of the request.
          </p>
        </section>

        <section aria-labelledby="privacy-security">
          <h2 id="privacy-security">9. Security</h2>
          <p>
            Implemented measures include password hashing, encrypted administrator TOTP secrets,
            hashed session tokens, server-side authorization checks, HMAC identifiers for analytics
            and rate limiting, consent-evidence checks before analytics collection, signed payment
            webhooks, audit logging, and a rule that payment card data is never collected. No
            system is perfectly secure; we review and improve these measures over time.
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
            or contact us at{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. You will receive a
            reference for the request. Requests that could affect an account require identity
            verification; an unauthenticated request containing only an email address is never
            sufficient to delete an account.
          </p>
          <p>
            We will not charge a fee for a routine request unless the law permits it. Complex or
            repetitive requests may require an extension or a fee where allowed. If a request is
            refused, the response will explain why and describe any available complaint route.
          </p>
          <p>
            Mandatory consumer protection and privacy laws applicable in your country of residence
            continue to apply notwithstanding the governing-law provision in the{" "}
            <Link href="/legal/terms">Terms of service</Link>.
          </p>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2 id="privacy-changes">11. Changes to this policy</h2>
          <p>
            Material changes will be published with a new version and effective date. Where consent
            is the legal basis, a new consent record may be required. The current published version
            is always available at this address.
          </p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact">12. Contact</h2>
          <p>
            Privacy questions and rights requests can be sent to{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or via the{" "}
            <Link href="/contact">contact page</Link>.
          </p>
        </section>
      </article>

      <BusinessDetails />
      <PrivacyContact />
      <SupportChannelNotice />
      <LegalDocumentFooter />
    </div>
  );
}
