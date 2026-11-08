import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { loadLegalSettings } from "@/lib/legal";
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
import { AlertIcon, ClockIcon, LockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Privacy request",
  description:
    "Submit an access, correction, deletion, restriction, portability, or objection request and check its status.",
  alternates: { canonical: "/privacy/request" },
};

export const dynamic = "force-dynamic";

export default async function PrivacyRequestPage() {
  const db = await getDb();
  const [settings, user] = await Promise.all([loadLegalSettings(db), getCurrentUser()]);

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">Privacy rights</p>
        <h1>Make a privacy request</h1>
        <p className="lead">
          Ask for access, correction, deletion, restriction, portability, or another applicable
          privacy right. Requests are recorded locally and reviewed by an administrator.
        </p>
      </header>

      <div className="callout callout-warning">
        <AlertIcon className="inline-icon" />
        <div>
          <p>
            <strong>This build does not send email.</strong> Submitting the form creates a local
            request reference. An administrator must verify identity out of band before disclosing
            or deleting account data. No live privacy inbox is connected.
          </p>
          <p className="small">
            Read the <Link href="/legal/privacy">Privacy Policy</Link> first. Do not include
            passwords, one-time authentication codes, full card numbers, or identity-document
            images.
          </p>
        </div>
      </div>

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
              <li>The request is stored with a reference and an unverified identity status.</li>
              <li>
                If you are signed in with the same email, the request is marked verified
                automatically. Otherwise an administrator must verify identity out of band.
              </li>
              <li>
                The administrator records a decision, resolution, or a reason for refusal. A
                deletion request anonymises the account profile but retains financial and audit
                records where required.
              </li>
              <li>You can check the status with the reference and email below.</li>
            </ol>
            <p className="small muted">
              No specific response deadline is promised in this draft. A live service must publish
              a deadline that matches the law in each market.
            </p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-rights-title">
            <h2 id="privacy-request-rights-title">
              <LockIcon className="inline-icon" /> Rights and limits
            </h2>
            <p>
              Depending on where you live, you may have rights to access, correct, delete, restrict,
              object, or receive a portable copy of your data, and to withdraw consent. These
              rights are not absolute. Legal recordkeeping, fraud prevention, dispute handling, or
              another lawful basis may limit a request.
            </p>
            <p>
              The controller identity and privacy contact must be configured before this page can
              be presented as a live rights channel. If they are blank, the request is still
              recorded locally, but the owner must add verified contact details.
            </p>
          </section>

          <section className="card form" aria-labelledby="privacy-request-auth-title">
            <h2 id="privacy-request-auth-title">Signed-in vs. anonymous requests</h2>
            <p>
              A signed-in session with a matching email verifies identity for the request. An
              anonymous submission is never enough to delete an account merely by typing an email
              address. This protects accounts from impersonation.
            </p>
            <p>
              If you cannot access the account email, explain that in the details. The owner must
              define a safe alternative verification process before production.
            </p>
          </section>
        </aside>
      </div>

      <section className="section-tight" aria-labelledby="privacy-lookup-title">
        <h2 id="privacy-lookup-title">Check an existing request</h2>
        <PrivacyRequestLookupForm />
      </section>

      <BusinessDetails settings={settings} />
      <PrivacyContact settings={settings} />
      <SupportChannelNotice settings={settings} />
    </div>
  );
}
