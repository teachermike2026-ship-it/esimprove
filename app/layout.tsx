import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DemoBanner } from "@/components/demo-banner";
import { demoMode, siteName, siteUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — demo eSIM travel store`,
    template: `%s · ${siteName}`,
  },
  description:
    "A demo-first eSIM travel storefront with destination pages, plan search, compatibility guidance, checkout, and a customer portal. No live payments or supplier orders.",
  applicationName: siteName,
  robots: demoMode
    ? { index: false, follow: false, nocache: true }
    : { index: true, follow: true },
  openGraph: {
    title: `${siteName} — demo eSIM travel store`,
    description:
      "Explore a functional demo eSIM storefront. Catalogue, prices, and activation data are illustrative; live integrations are disabled.",
    url: siteUrl,
    siteName,
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <DemoBanner />
        <SiteHeader />
        <main id="main" className="container page-main">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
