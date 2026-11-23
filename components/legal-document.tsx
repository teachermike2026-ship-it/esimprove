import Link from "next/link";
import {
  LEGAL_DOCUMENT_VERSION,
  LEGAL_EFFECTIVE_DATE_LABEL,
  LEGAL_BRAND,
  LEGAL_BUSINESS_COUNTRY,
  LEGAL_BUSINESS_TYPE,
  LEGAL_CONTACT_EMAIL,
  LEGAL_JURISDICTION,
  LEGAL_NOT_A_REGISTERED_ENTITY,
  LEGAL_PLATFORM_LINE,
  LEGAL_PHYSICAL_OFFICE,
} from "@/lib/legal-profile";
import { CheckIcon, MailIcon } from "@/components/icons";

export function LegalDocumentHeader({
  title,
  intro,
}: {
  title: string;
  intro: string;
}) {
  return (
    <header className="legal-header">
      <p className="eyebrow">Legal</p>
      <h1>{title}</h1>
      <p className="lead">{intro}</p>
      <dl className="legal-meta">
        <div>
          <dt>Document version</dt>
          <dd>{LEGAL_DOCUMENT_VERSION}</dd>
        </div>
        <div>
          <dt>Effective date</dt>
          <dd>{LEGAL_EFFECTIVE_DATE_LABEL}</dd>
        </div>
        <div>
          <dt>Business</dt>
          <dd>{LEGAL_PLATFORM_LINE}</dd>
        </div>
      </dl>
    </header>
  );
}

export function BusinessDetails() {
  return (
    <section className="card form legal-business" aria-labelledby="business-details-title">
      <h2 id="business-details-title">Business and contact details</h2>
      <dl className="meta-list">
        <div>
          <dt>Brand</dt>
          <dd>{LEGAL_BRAND}</dd>
        </div>
        <div>
          <dt>Business type</dt>
          <dd>{LEGAL_BUSINESS_TYPE}</dd>
        </div>
        <div>
          <dt>Business country</dt>
          <dd>{LEGAL_BUSINESS_COUNTRY} (provisional operating location)</dd>
        </div>
        <div>
          <dt>Physical office</dt>
          <dd>{LEGAL_PHYSICAL_OFFICE}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          </dd>
        </div>
        <div>
          <dt>Customer support</dt>
          <dd>
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          </dd>
        </div>
        <div>
          <dt>Privacy contact</dt>
          <dd>
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          </dd>
        </div>
        <div>
          <dt>Governing jurisdiction</dt>
          <dd>{LEGAL_JURISDICTION}</dd>
        </div>
      </dl>
      <p className="small muted">{LEGAL_NOT_A_REGISTERED_ENTITY}</p>
    </section>
  );
}

export function PrivacyContact() {
  return (
    <section className="card form" aria-labelledby="privacy-contact-title">
      <h2 id="privacy-contact-title">How to contact us about privacy</h2>
      <p>
        Privacy questions and rights requests can be sent to{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
      <p>
        You can also use the{" "}
        <Link href="/privacy/request">privacy request form</Link> with or without signing in.
        Requests that could affect or delete an account require identity verification before any
        account data is accessed, changed, or disclosed.
      </p>
      <p className="small muted">
        <MailIcon className="inline-icon" /> Do not send passwords, full card numbers, or
        authentication codes in a privacy request.
      </p>
    </section>
  );
}

export function LegalDocumentFooter() {
  return (
    <footer className="legal-footer">
      <p>
        <CheckIcon className="inline-icon" /> Version {LEGAL_DOCUMENT_VERSION} · Effective{" "}
        {LEGAL_EFFECTIVE_DATE_LABEL}.
      </p>
      <p className="small muted">
        This page is not legal advice and does not create a lawyer-client relationship.
      </p>
    </footer>
  );
}

export function SupportChannelNotice() {
  return (
    <div className="callout">
      <p>
        <strong>Support:</strong> Customer support enquiries can be sent to{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Include your order
        reference where relevant. There is no telephone support line.
      </p>
    </div>
  );
}
