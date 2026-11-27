import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalBody, LegalProfile, renderInline } from "@/components/legal-content";
import { getDb } from "@/lib/db/client";
import { localeDescriptors } from "@/lib/i18n/config";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { getI18n } from "@/lib/i18n/server";
import {
  LEGAL_DOC_PATHS,
  legalDoc,
  legalProfile,
  type LegalContext,
  type LegalDocKey,
} from "@/lib/legal-content";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/legal-profile";
import { loadSeoSettings } from "@/lib/seo";

/** Documents whose wording depends on whether Google Analytics is configured. */
const NEEDS_GA4: LegalDocKey[] = ["privacy", "cookies"];

async function legalContext(key: LegalDocKey): Promise<LegalContext> {
  let ga4Configured = false;
  if (NEEDS_GA4.includes(key)) {
    const seo = await loadSeoSettings(await getDb());
    ga4Configured = Boolean(seo.ga4MeasurementId && /^G-[A-Z0-9]{6,}$/i.test(seo.ga4MeasurementId));
  }
  return { email: LEGAL_CONTACT_EMAIL, ga4Configured };
}

export async function legalMetadata(key: LegalDocKey): Promise<Metadata> {
  const { locale } = await getI18n();
  const doc = legalDoc(locale, key, { email: LEGAL_CONTACT_EMAIL, ga4Configured: false });
  return localizedMetadata({ path: LEGAL_DOC_PATHS[key], title: doc.title, description: doc.description });
}

export async function LegalPage({ docKey, children }: { docKey: LegalDocKey; children?: ReactNode }) {
  const { locale, t, href } = await getI18n();
  const ctx = await legalContext(docKey);
  const doc = legalDoc(locale, docKey, ctx);
  const profile = legalProfile(locale, ctx);
  const effective = new Intl.DateTimeFormat(localeDescriptors[locale].intlLocale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_EFFECTIVE_DATE}T00:00:00Z`));

  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">{t("legal.eyebrow")}</p>
        <h1>{doc.title}</h1>
        <p className="lead">{renderInline(doc.intro, ctx.email, href)}</p>
        <dl className="legal-meta">
          <div>
            <dt>{t("legal.documentVersion")}</dt>
            <dd>{LEGAL_DOCUMENT_VERSION}</dd>
          </div>
          <div>
            <dt>{t("legal.effectiveDate")}</dt>
            <dd>{effective}</dd>
          </div>
        </dl>
        <p className="small muted">{profile.translationNote}</p>
      </header>

      <LegalBody doc={doc} email={ctx.email} href={href} contentsLabel={t("legal.contents")} />
      {children}
      <LegalProfile profile={profile} email={ctx.email} href={href} />
    </div>
  );
}
