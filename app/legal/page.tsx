import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_EFFECTIVE_DATE_LABEL,
} from "@/lib/legal-profile";
import { ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Legal & privacy",
  description:
    "ESIMPROVE legal documents and privacy choices: terms of service, privacy policy, refund policy, cookie policy, accessibility statement, and privacy request route.",
  alternates: { canonical: "/legal" },
};

const documents = [
  {
    title: "Terms of service",
    shortTitle: "Terms of service",
    path: "/legal/terms",
    description:
      "The agreement covering accounts, orders, digital eSIM delivery, fair use, liability, and your rights and responsibilities.",
  },
  {
    title: "Privacy policy",
    shortTitle: "Privacy policy",
    path: "/legal/privacy",
    description:
      "What information ESIMPROVE collects, why, how long it is kept, and how you can exercise your privacy rights.",
  },
  {
    title: "Refund policy",
    shortTitle: "Refund policy",
    path: "/legal/refunds",
    description:
      "When you can cancel or request a refund, how refunds are processed, and how mandatory consumer rights apply.",
  },
  {
    title: "Cookie policy",
    shortTitle: "Cookie policy",
    path: "/legal/cookies",
    description:
      "Cookies and browser storage used by ESIMPROVE, the consent categories, and how to withdraw consent.",
  },
  {
    title: "Accessibility statement",
    shortTitle: "Accessibility statement",
    path: "/legal/accessibility",
    description:
      "Accessibility measures, known limitations, and how to report a barrier you encounter.",
  },
  {
    title: "Legal FAQ",
    shortTitle: "Legal FAQ",
    path: "/legal/faq",
    description:
      "Short answers about legal documents, orders, refunds, and privacy requests.",
  },
];

export default function LegalIndexPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">Legal &amp; privacy</p>
        <h1>Legal documents and privacy choices</h1>
        <p className="lead">
          The current published versions of ESIMPROVE&apos;s legal documents. Questions are
          welcome at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </header>

      <div className="legal-doc-grid">
        {documents.map((document) => (
          <article className="card legal-doc-card" key={document.path}>
            <div className="legal-doc-card-head">
              <h2>{document.title}</h2>
            </div>
            <p>{document.description}</p>
            <dl className="legal-meta legal-meta-compact">
              <div>
                <dt>Version</dt>
                <dd>{LEGAL_DOCUMENT_VERSION}</dd>
              </div>
              <div>
                <dt>Effective</dt>
                <dd>{LEGAL_EFFECTIVE_DATE_LABEL}</dd>
              </div>
            </dl>
            <Link className="es-text-link" href={document.path}>
              Read {document.shortTitle.toLowerCase()} <ArrowRight />
            </Link>
          </article>
        ))}
      </div>

      <section className="card form section-tight">
        <h2>Exercise a privacy right</h2>
        <p>
          Use the <Link href="/privacy/request">privacy request form</Link> to ask for access,
          correction, deletion, restriction, portability, or another applicable right. Requests
          that could affect an account require identity verification. Financial records that must be
          retained are not automatically deleted.
        </p>
        <p>
          General questions can be sent to{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or via the{" "}
          <Link href="/contact">contact page</Link>.
        </p>
      </section>
    </div>
  );
}
