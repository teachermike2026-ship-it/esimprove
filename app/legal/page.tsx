import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  LEGAL_DOCUMENTS,
  documentMeta,
  formatLegalDate,
  loadLegalSettings,
} from "@/lib/legal";
import { AlertIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Legal & privacy",
  description:
    "Draft legal documents, privacy request route, and compliance status for the Esimprove demonstration storefront.",
  alternates: { canonical: "/legal" },
};

export const dynamic = "force-dynamic";

export default async function LegalIndexPage() {
  const settings = await loadLegalSettings(await getDb());

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">Legal &amp; compliance</p>
        <h1>Legal documents and privacy choices</h1>
        <p className="lead">
          These documents describe the behaviour implemented in this build. They are drafts
          while owner business details and professional legal review are outstanding.
        </p>
      </header>

      <div className="callout callout-warning">
        <AlertIcon className="inline-icon" />
        <p>
          <strong>Not a compliance certificate.</strong> The presence of these pages does not
          establish GDPR, CCPA, or any other legal compliance. Final wording, jurisdiction, and
          mandatory consumer protections require review by a qualified legal professional.
        </p>
      </div>

      <div className="legal-doc-grid">
        {LEGAL_DOCUMENTS.map((document) => {
          const meta = documentMeta(settings, document.key);
          return (
            <article className="card legal-doc-card" key={document.key}>
              <div className="legal-doc-card-head">
                <h2>{document.title}</h2>
                <span className={`badge ${meta.status === "complete" ? "badge-success" : "badge-warning"}`}>
                  {meta.status.replaceAll("_", " ")}
                </span>
              </div>
              <p>{document.description}</p>
              <dl className="legal-meta legal-meta-compact">
                <div>
                  <dt>Version</dt>
                  <dd>{meta.version}</dd>
                </div>
                <div>
                  <dt>Effective</dt>
                  <dd>{formatLegalDate(meta.effectiveDate)}</dd>
                </div>
              </dl>
              <Link className="es-text-link" href={document.path}>
                Read {document.shortTitle.toLowerCase()} <ArrowRight />
              </Link>
            </article>
          );
        })}
      </div>

      <section className="card form section-tight">
        <h2>Exercise a privacy right</h2>
        <p>
          Use the <Link href="/privacy/request">privacy request form</Link> to ask for access,
          correction, deletion, restriction, portability, or another applicable right. Requests
          that could delete an account require identity verification and administrator review.
          Financial records that must be retained are not automatically deleted.
        </p>
        <p>
          General questions can use the <Link href="/contact">contact page</Link>. No live
          support inbox is connected in this demo.
        </p>
      </section>
    </div>
  );
}
