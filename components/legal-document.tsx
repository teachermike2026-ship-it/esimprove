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
import { getI18n } from "@/lib/i18n/server";

export async function LegalDocumentHeader({
  title,
  intro,
}: {
  title: string;
  intro: string;
}) {
  const { t } = await getI18n();
  return (
    <header className="legal-header">
      <p className="eyebrow">{t("legal.eyebrow")}</p>
      <h1>{title}</h1>
      <p className="lead">{intro}</p>
      <dl className="legal-meta">
        <div>
          <dt>{t("legal.documentVersion")}</dt>
          <dd>{LEGAL_DOCUMENT_VERSION}</dd>
        </div>
        <div>
          <dt>{t("legal.effectiveDate")}</dt>
          <dd>{LEGAL_EFFECTIVE_DATE_LABEL}</dd>
        </div>
        <div>
          <dt>{t("legal.business")}</dt>
          <dd>{LEGAL_PLATFORM_LINE}</dd>
        </div>
      </dl>
      <p className="small muted">{t("legal.englishAuthoritative")}</p>
    </header>
  );
}

export async function BusinessDetails() {
  const { t } = await getI18n();
  return (
    <section className="card form legal-business" aria-labelledby="business-details-title">
      <h2 id="business-details-title">{t("legal.businessDetails")}</h2>
      <dl className="meta-list">
        <div>
          <dt>{t("legal.brand")}</dt>
          <dd>{LEGAL_BRAND}</dd>
        </div>
        <div>
          <dt>{t("legal.businessType")}</dt>
          <dd>{LEGAL_BUSINESS_TYPE}</dd>
        </div>
        <div>
          <dt>{t("legal.businessCountry")}</dt>
          <dd>{LEGAL_BUSINESS_COUNTRY} (provisional operating location)</dd>
        </div>
        <div>
          <dt>{t("legal.physicalOffice")}</dt>
          <dd>{LEGAL_PHYSICAL_OFFICE}</dd>
        </div>
        <div>
          <dt>{t("legal.contact")}</dt>
          <dd>
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          </dd>
        </div>
        <div>
          <dt>{t("legal.customerSupport")}</dt>
          <dd>
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          </dd>
        </div>
        <div>
          <dt>{t("legal.privacyContact")}</dt>
          <dd>
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          </dd>
        </div>
        <div>
          <dt>{t("legal.governingJurisdiction")}</dt>
          <dd>{LEGAL_JURISDICTION}</dd>
        </div>
      </dl>
      <p className="small muted">{LEGAL_NOT_A_REGISTERED_ENTITY}</p>
    </section>
  );
}

export async function PrivacyContact() {
  const { t, href } = await getI18n();
  return (
    <section className="card form" aria-labelledby="privacy-contact-title">
      <h2 id="privacy-contact-title">{t("legal.privacyContactTitle")}</h2>
      <p>{t("legal.privacyContactBody", { email: LEGAL_CONTACT_EMAIL })}</p>
      <p>{t("legal.privacyContactBody2")}</p>
      <p>
        <Link className="es-text-link" href={href("/privacy/request")}>
          {t("legal.privacyRequestLink")}
        </Link>
      </p>
      <p className="small muted">
        <MailIcon className="inline-icon" /> {t("legal.privacyContactNote")}
      </p>
    </section>
  );
}

export async function LegalDocumentFooter() {
  const { t } = await getI18n();
  return (
    <footer className="legal-footer">
      <p>
        <CheckIcon className="inline-icon" />{" "}
        {t("legal.footerVersion", {
          version: LEGAL_DOCUMENT_VERSION,
          date: LEGAL_EFFECTIVE_DATE_LABEL,
        })}
      </p>
      <p className="small muted">{t("legal.footerNote")}</p>
    </footer>
  );
}

export async function SupportChannelNotice() {
  const { t } = await getI18n();
  return (
    <div className="callout">
      <p>
        <strong>{t("legal.supportTitle")}</strong>{" "}
        {t("legal.supportBody", { email: LEGAL_CONTACT_EMAIL })}
      </p>
    </div>
  );
}
