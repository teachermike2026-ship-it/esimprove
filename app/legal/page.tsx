import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/legal-profile";
import { ArrowRight } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localeDescriptors } from "@/lib/i18n/config";
import { LEGAL_DOC_KEYS, LEGAL_DOC_PATHS, legalDoc } from "@/lib/legal-content";
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
  const { t, href, locale } = await getI18n();
  const ctx = { email: LEGAL_CONTACT_EMAIL, ga4Configured: false };
  const effectiveLabel = new Intl.DateTimeFormat(localeDescriptors[locale].intlLocale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_EFFECTIVE_DATE}T00:00:00Z`));
  const documents = [
    ...LEGAL_DOC_KEYS.map((key) => {
      const doc = legalDoc(locale, key, ctx);
      return { title: doc.title, shortTitle: doc.title, path: LEGAL_DOC_PATHS[key], description: doc.description };
    }),
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
                <dd>{effectiveLabel}</dd>
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
