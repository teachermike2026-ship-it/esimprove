import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_EFFECTIVE_DATE_LABEL,
} from "@/lib/legal-profile";
import { ArrowRight } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/legal",
    title: t("legal.metaTitle"),
    description: t("legal.metaDescription"),
  });
}

export default async function LegalIndexPage() {
  const { t, href } = await getI18n();
  const documents = [
    {
      title: t("legal.terms"),
      shortTitle: t("legal.terms"),
      path: "/legal/terms",
      description: t("legal.termsDescription"),
    },
    {
      title: t("legal.privacy"),
      shortTitle: t("legal.privacy"),
      path: "/legal/privacy",
      description: t("legal.privacyDescription"),
    },
    {
      title: t("legal.refunds"),
      shortTitle: t("legal.refunds"),
      path: "/legal/refunds",
      description: t("legal.refundsDescription"),
    },
    {
      title: t("legal.cookies"),
      shortTitle: t("legal.cookies"),
      path: "/legal/cookies",
      description: t("legal.cookiesDescription"),
    },
    {
      title: t("legal.accessibility"),
      shortTitle: t("legal.accessibility"),
      path: "/legal/accessibility",
      description: t("legal.accessibilityDescription"),
    },
    {
      title: t("legal.faq"),
      shortTitle: t("legal.faq"),
      path: "/legal/faq",
      description: t("legal.faqDescription"),
    },
  ];

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">{t("legal.eyebrow")}</p>
        <h1>{t("legal.title")}</h1>
        <p className="lead">{t("legal.lead", { email: LEGAL_CONTACT_EMAIL })}</p>
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
                <dt>{t("legal.version")}</dt>
                <dd>{LEGAL_DOCUMENT_VERSION}</dd>
              </div>
              <div>
                <dt>{t("legal.effective")}</dt>
                <dd>{LEGAL_EFFECTIVE_DATE_LABEL}</dd>
              </div>
            </dl>
            <Link className="es-text-link" href={href(document.path)}>
              {t("legal.read", { title: document.shortTitle })} <ArrowRight />
            </Link>
          </article>
        ))}
      </div>

      <section className="card form section-tight">
        <h2>{t("legal.privacyRightTitle")}</h2>
        <p>{t("legal.privacyRightBody")}</p>
        <p>
          <Link className="es-text-link" href={href("/privacy/request")}>
            {t("legal.privacyRequestLink")} <ArrowRight />
          </Link>
        </p>
        <p>{t("legal.privacyRightBody2", { email: LEGAL_CONTACT_EMAIL })}</p>
      </section>
    </div>
  );
}
