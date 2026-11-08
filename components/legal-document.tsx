import Link from "next/link";
import {
  LEGAL_DISCLAIMER,
  businessProfileMissing,
  configuredBusinessName,
  configuredPrivacyEmail,
  configuredSupportEmail,
  documentIsPublishable,
  documentMeta,
  formatBusinessAddress,
  formatLegalDate,
  isBusinessProfileComplete,
  type LegalDocumentKey,
} from "@/lib/legal";
import type { LegalSettingsRow } from "@/lib/db/schema";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";

function StatusBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ");
  const tone =
    status === "complete" ? "badge-success" : status === "not_verified" ? "badge-danger" : "badge-warning";
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function LegalDocumentHeader({
  settings,
  documentKey,
  title,
  intro,
}: {
  settings: LegalSettingsRow;
  documentKey: LegalDocumentKey;
  title: string;
  intro: string;
}) {
  const meta = documentMeta(settings, documentKey);
  const publishable = documentIsPublishable(settings, documentKey);
  const missing = businessProfileMissing(settings);

  return (
    <header className="legal-header">
      <p className="eyebrow">Legal &amp; compliance</p>
      <div className="legal-title-row">
        <h1>{title}</h1>
        <StatusBadge status={meta.status} />
      </div>
      <p className="lead">{intro}</p>
      <dl className="legal-meta">
        <div>
          <dt>Document version</dt>
          <dd>{meta.version}</dd>
        </div>
        <div>
          <dt>Effective date</dt>
          <dd>{formatLegalDate(meta.effectiveDate)}</dd>
        </div>
        <div>
          <dt>Business</dt>
          <dd>{configuredBusinessName(settings) || "Not configured"}</dd>
        </div>
      </dl>

      {!publishable ? (
        <div className="callout callout-warning" role="note">
          <AlertIcon className="inline-icon" />
          <div>
            <p>
              <strong>This document is a draft and is not presented as an effective legal
              policy.</strong>{" "}
              {missing.length > 0
                ? "The owner must add verified business details before publication."
                : "The document still requires professional legal review and an effective date."}
            </p>
            {missing.length > 0 ? (
              <p className="small">
                Missing owner information: {missing.map((entry) => entry.label).join(", ")}.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="legal-disclaimer">{LEGAL_DISCLAIMER}</p>
    </header>
  );
}

export function BusinessDetails({ settings }: { settings: LegalSettingsRow }) {
  if (!isBusinessProfileComplete(settings)) {
    const missing = businessProfileMissing(settings);
    return (
      <section className="card form legal-business" aria-labelledby="business-details-title">
        <h2 id="business-details-title">Business details</h2>
        <div className="callout callout-warning">
          <AlertIcon className="inline-icon" />
          <p>
            Verified business details are not configured in this build. No legal name,
            registration number, address, telephone number, or VAT number has been invented.
          </p>
        </div>
        <p className="small muted">
          Required before publication: {missing.map((entry) => entry.label).join(", ")}.
        </p>
        <p className="small">
          The owner can add these details in the admin Legal &amp; Compliance section.
        </p>
      </section>
    );
  }

  return (
    <section className="card form legal-business" aria-labelledby="business-details-title">
      <h2 id="business-details-title">Business details</h2>
      <dl className="meta-list">
        <div>
          <dt>Legal name</dt>
          <dd>{settings.legalName}</dd>
        </div>
        {settings.tradingName ? (
          <div>
            <dt>Trading name</dt>
            <dd>{settings.tradingName}</dd>
          </div>
        ) : null}
        <div>
          <dt>Registered address</dt>
          <dd>{formatBusinessAddress(settings)}</dd>
        </div>
        <div>
          <dt>Business country</dt>
          <dd>{settings.businessCountry}</dd>
        </div>
        {settings.registrationNumber ? (
          <div>
            <dt>Registration number</dt>
            <dd>{settings.registrationNumber}</dd>
          </div>
        ) : null}
        {settings.vatNumber ? (
          <div>
            <dt>VAT / tax number</dt>
            <dd>{settings.vatNumber}</dd>
          </div>
        ) : null}
        {settings.taxDetails ? (
          <div>
            <dt>Tax details</dt>
            <dd>{settings.taxDetails}</dd>
          </div>
        ) : null}
        <div>
          <dt>Contact email</dt>
          <dd>
            <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          </dd>
        </div>
        {settings.supportEmail ? (
          <div>
            <dt>Customer support</dt>
            <dd>
              <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
            </dd>
          </div>
        ) : null}
        {settings.phone ? (
          <div>
            <dt>Telephone</dt>
            <dd>{settings.phone}</dd>
          </div>
        ) : null}
        <div>
          <dt>Privacy contact</dt>
          <dd>
            <a href={`mailto:${configuredPrivacyEmail(settings)}`}>
              {configuredPrivacyEmail(settings)}
            </a>
          </dd>
        </div>
        {settings.legalContact ? (
          <div>
            <dt>Legal contact</dt>
            <dd>{settings.legalContact}</dd>
          </div>
        ) : null}
        <div>
          <dt>Applicable jurisdiction</dt>
          <dd>{settings.jurisdiction}</dd>
        </div>
      </dl>
    </section>
  );
}

export function PrivacyContact({ settings }: { settings: LegalSettingsRow }) {
  const email = configuredPrivacyEmail(settings);
  return (
    <section className="card form" aria-labelledby="privacy-contact-title">
      <h2 id="privacy-contact-title">How to contact us about privacy</h2>
      {email ? (
        <>
          <p>
            Privacy questions and rights requests can be sent to{" "}
            <a href={`mailto:${email}`}>{email}</a>.
          </p>
          <p>
            You can also use the{" "}
            <Link href="/privacy/request">privacy request form</Link> without signing in.
            Requests that could delete an account require identity verification.
          </p>
        </>
      ) : (
        <div className="callout callout-warning">
          <AlertIcon className="inline-icon" />
          <p>
            No privacy contact email is configured yet. The owner must add a monitored privacy
            contact before this policy can be published. The{" "}
            <Link href="/privacy/request">privacy request form</Link> records requests locally
            but cannot send email in this build.
          </p>
        </div>
      )}
      <p className="small muted">
        <MailIcon className="inline-icon" /> Do not send passwords, full card numbers, or
        authentication codes in a privacy request.
      </p>
    </section>
  );
}

export function LegalDocumentFooter({
  settings,
  documentKey,
}: {
  settings: LegalSettingsRow;
  documentKey: LegalDocumentKey;
}) {
  const meta = documentMeta(settings, documentKey);
  return (
    <footer className="legal-footer">
      <p>
        <CheckIcon className="inline-icon" /> Version {meta.version} · Effective{" "}
        {formatLegalDate(meta.effectiveDate)}.
      </p>
      <p className="small muted">
        This page is part of a demonstration storefront. It is not legal advice and does not
        create a lawyer-client relationship.
      </p>
    </footer>
  );
}

export function SupportChannelNotice({ settings }: { settings: LegalSettingsRow }) {
  const email = configuredSupportEmail(settings);
  return (
    <div className="callout">
      <p>
        <strong>Support routing:</strong>{" "}
        {email ? (
          <>
            Customer support email is configured as{" "}
            <a href={`mailto:${email}`}>{email}</a>. Response times are not promised unless the
            owner publishes a verified service window.
          </>
        ) : (
          <>
            No customer support email is configured. The contact form stores a local request,
            but no live support inbox is connected in this build.
          </>
        )}
      </p>
    </div>
  );
}
