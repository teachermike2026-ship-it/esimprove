import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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

export const dynamic = "force-dynamic";

const manrope = localFont({
  src: "./fonts/manrope-latin.woff2",
  weight: "400 800",
  style: "normal",
  display: "swap",
  variable: "--font-manrope",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});

const fallbackDescription =
  "Compare travel eSIM plans by destination. Explore data, validity, and pricing in the Esimprove storefront.";

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
  const settings = await safeSettings();
  const resolvedName = settings?.siteName || siteName;
  const title = settings?.homepageTitle || `${resolvedName} — travel eSIMs for your next trip`;
  const description = settings?.homepageDescription || fallbackDescription;
  const base = settings?.canonicalBase || siteUrl;
  const ogDescription = settings?.defaultOgDescription || description;
  const ogTitle = settings?.defaultOgTitle || title;
  const ogImage = settings?.defaultOgImage;
  const verification = settings?.gscVerificationToken;

  return {
    metadataBase: new URL(base),
    title: {
      default: title,
      template: settings ? titleTemplateForNext(settings) : `%s · ${resolvedName}`,
    },
    description,
    applicationName: resolvedName,
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
      url: base,
      siteName: resolvedName,
      type: "website",
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
  const [settings, legalSettings] = await Promise.all([safeSettings(), safeLegalSettings()]);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const siteJsonLd = settings ? buildSiteJsonLd(settings) : null;
  const ga4 = settings?.ga4MeasurementId;
  const ga4Enabled = Boolean(ga4 && /^G-[A-Z0-9]{6,}$/i.test(ga4) && !noIndex);
  const consentVersion = legalSettings.cookieConsentVersion;

  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
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
      </body>
    </html>
  );
}
