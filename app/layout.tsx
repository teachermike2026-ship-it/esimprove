import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { I18nProvider } from "@/components/i18n-provider";
import {
  AnalyticsTracker,
  ConsentManager,
  Ga4Loader,
} from "@/components/analytics-tracker";
import { noIndex, siteName, siteUrl } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { defaultLegalSettings, loadLegalSettings, type LegalSettingsRow } from "@/lib/legal";
import {
  buildSiteJsonLd,
  loadSeoSettings,
  titleTemplateForNext,
  type SeoSettings,
} from "@/lib/seo";
import { getI18n } from "@/lib/i18n/server";
import {
  absoluteLocalizedUrl,
  localeDescriptors,
  localeOg,
  locales,
} from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

const manrope = localFont({
  src: "./fonts/manrope-latin.woff2",
  weight: "400 800",
  style: "normal",
  display: "swap",
  variable: "--font-manrope",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});



async function safeSettings(): Promise<SeoSettings | null> {
  try {
    const db = await getDb();
    return await loadSeoSettings(db);
  } catch {
    return null;
  }
}

async function safeLegalSettings(): Promise<LegalSettingsRow> {
  try {
    const db = await getDb();
    return await loadLegalSettings(db);
  } catch {
    return defaultLegalSettings();
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [settings, i18n] = await Promise.all([safeSettings(), getI18n()]);
  const resolvedName = settings?.siteName || siteName;
  const title = settings?.homepageTitle || i18n.t("home.metaTitle");
  const description = settings?.homepageDescription || i18n.t("home.metaDescription");
  const base = settings?.canonicalBase || siteUrl;
  const ogDescription = settings?.defaultOgDescription || description;
  const ogTitle = settings?.defaultOgTitle || title;
  const ogImage = settings?.defaultOgImage;
  const verification = settings?.gscVerificationToken;
  const pathname = i18n.pathname || "/";
  const languages = Object.fromEntries(
    locales.map((code) => [code, absoluteLocalizedUrl(pathname, code, base)]),
  );
  languages["x-default"] = absoluteLocalizedUrl(pathname, "en", base);
  const currentUrl = absoluteLocalizedUrl(pathname, i18n.locale, base);

  return {
    metadataBase: new URL(base),
    title: {
      default: title,
      template: settings ? titleTemplateForNext(settings) : `%s · ${resolvedName}`,
    },
    description,
    applicationName: resolvedName,
    alternates: {
      canonical: currentUrl,
      languages,
    },
    ...(settings?.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
    ...(verification ? { verification: { google: verification } } : {}),
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : settings?.indexDefault === false
        ? { index: false, follow: false }
        : { index: true, follow: true },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: currentUrl,
      siteName: resolvedName,
      type: "website",
      locale: localeOg(i18n.locale),
      ...(ogImage ? { images: [{ url: ogImage, alt: resolvedName }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, legalSettings, i18n] = await Promise.all([
    safeSettings(),
    safeLegalSettings(),
    getI18n(),
  ]);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const siteJsonLd = settings ? buildSiteJsonLd(settings) : null;
  const ga4 = settings?.ga4MeasurementId;
  const ga4Enabled = Boolean(ga4 && /^G-[A-Z0-9]{6,}$/i.test(ga4) && !noIndex);
  const consentVersion = legalSettings.cookieConsentVersion;
  const descriptor = localeDescriptors[i18n.locale];

  return (
    <html
      lang={descriptor.htmlLang}
      dir={descriptor.dir}
      className={manrope.variable}
    >
      <body>
        <I18nProvider
          locale={i18n.locale}
          dir={i18n.dir}
          dictionary={i18n.dictionary}
        >
          <a className="skip-link" href="#main">
            {i18n.t("common.skipToContent")}
          </a>
          {siteJsonLd ? (
            <script
              type="application/ld+json"
              nonce={nonce}
              dangerouslySetInnerHTML={{ __html: siteJsonLd }}
            />
          ) : null}
          <SiteHeader />
          <main id="main" className="container page-main">
            {children}
          </main>
          <SiteFooter />
          <Ga4Loader
            measurementId={ga4Enabled && ga4 ? ga4 : ""}
            consentVersion={consentVersion}
            nonce={nonce}
          />
          <AnalyticsTracker consentVersion={consentVersion} />
          <ConsentManager consentVersion={consentVersion} />
        </I18nProvider>
      </body>
    </html>
  );
}
