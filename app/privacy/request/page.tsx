import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import {
  PrivacyRequestForm,
  PrivacyRequestLookupForm,
} from "@/components/privacy-request-form";
import {
  BusinessDetails,
  PrivacyContact,
  SupportChannelNotice,
} from "@/components/legal-document";
import { ClockIcon, LockIcon } from "@/components/icons";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";

export const metadata: Metadata = {
  title: "Privacy request",
  description:
    "Submit an access, correction, deletion, restriction, portability, or objection request and check its status.",
  alternates: { canonical: "/privacy/request" },
};

export const dynamic = "force-dynamic";

export default async function PrivacyRequestPage() {
  const user = await getCurrentUser();

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">Privacy rights</p>
        <h1>Make a privacy request</h1>
        <p className="lead">
          Ask for access, correction, deletion, restriction, portability, or objection. Your
          request is recorded with a reference so it can be reviewed and verified.
        </p>
      </header>

      <div className="privacy-request-grid">
        <section aria-labelledby="privacy-request-form-title">
          <h2 id="privacy-request-form-title">Submit a request</h2>
          <PrivacyRequestForm defaultEmail={user?.email ?? ""} />
        </section>

        <aside className="privacy-request-aside">
          <section className="card form" aria-labelledby="privacy-request-process-title">
            <h2 id="privacy-request-process-title">
              <ClockIcon className="inline-icon" /> What happens next
            </h2>
            <ol className="simple-list">
              <li>The request is recorded with a reference and an unverified identity status.</li>
              <li>
                If you are signed in with the same email address, the request is marked verified
                automatically. Otherwise an administrator verifies your identity before disclosing
                or changing any account data.
              </li>
              <li>
                The administrator records a decision, a resolution, or a reason for refusal. A
                deletion request anonymises the account profile while financial and audit records
                are retained where the law requires them.
              </li>
              <li>You can check the status at any time with the reference and email below.</li>
            </ol>
            <p className="small muted">
              No notification email is sent automatically. Keep your request reference and check
              the status here, or email{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> if you need an
              update. Response times follow the requirements of the privacy laws that apply to you.
            </p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-rights-title">
            <h2 id="privacy-request-rights-title">
              <LockIcon className="inline-icon" /> Rights and limits
            </h2>
            <p>
              Depending on where you live, you may have rights to access, correct, delete, restrict,
              object to, or receive a portable copy of your data, and to withdraw consent. These
              rights are not absolute. Legal recordkeeping, fraud prevention, dispute handling, or
              another lawful basis may limit a request.
            </p>
            <p>
              Read the <a href="/legal/privacy">Privacy policy</a> first, then submit your request
              here or email{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
            </p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-auth-title">
            <h2 id="privacy-request-auth-title">Signed-in vs. anonymous requests</h2>
            <p>
              A signed-in session with a matching email verifies identity for the request. An
              anonymous submission is never enough to delete an account merely by typing an email
              address; this protects accounts from impersonation.
            </p>
            <p>
              If you cannot access the account email, explain that in the details of your request
              and we will agree on a safe way to verify your identity.
            </p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-format-title">
            <h2 id="privacy-request-format-title">What not to include</h2>
            <p>
              Do not include passwords, one-time authentication codes, full card numbers, or
              identity-document images in your request. If verification documents are ever needed,
              we will tell you what is acceptable and why.
            </p>
          </section>
        </aside>
      </div>

      <section className="section-tight" aria-labelledby="privacy-lookup-title">
        <h2 id="privacy-lookup-title">Check an existing request</h2>
        <PrivacyRequestLookupForm />
      </section>

      <BusinessDetails />
      <PrivacyContact />
      <SupportChannelNotice />
    </div>
  );
}
