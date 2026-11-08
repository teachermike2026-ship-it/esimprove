import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { CookieSettingsButton } from "@/components/analytics-tracker";
import {
  configuredBusinessName,
  configuredPrivacyEmail,
  configuredSupportEmail,
  formatBusinessAddress,
  isBusinessProfileComplete,
} from "@/lib/legal";
import type { LegalSettingsRow } from "@/lib/db/schema";
import { demoMode } from "@/lib/config";

const footerGroups = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Esimprove" },
      { href: "/contact", label: "Contact" },
      { href: "/about#how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Destinations",
    links: [
      { href: "/destinations", label: "Countries" },
      { href: "/regions", label: "Regional plans" },
      { href: "/plans", label: "All plans" },
      { href: "/compatibility", label: "Compatibility" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/guides", label: "Help centre" },
      { href: "/guides", label: "Installation guide" },
      { href: "/compatibility", label: "Device compatibility" },
      { href: "/#faq", label: "FAQs" },
      { href: "/#demo-limits", label: "Demo limits" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/refunds", label: "Refunds & cancellation" },
      { href: "/legal/cookies", label: "Cookie policy" },
      { href: "/legal/accessibility", label: "Accessibility" },
      { href: "/privacy/request", label: "Privacy request" },
      { href: "/contact", label: "Contact & support" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
      { href: "/portal", label: "My eSIMs" },
      { href: "/portal", label: "My orders" },
    ],
  },
];

export function SiteFooter({ legalSettings }: { legalSettings: LegalSettingsRow }) {
  const year = new Date().getUTCFullYear();
  const businessName = configuredBusinessName(legalSettings);
  const businessComplete = isBusinessProfileComplete(legalSettings);
  const supportEmail = configuredSupportEmail(legalSettings);
  const privacyEmail = configuredPrivacyEmail(legalSettings);
  const address = formatBusinessAddress(legalSettings);

  return (
    <footer className="es-footer">
      <div className="es-shell">
        <div className="es-footer-top">
          <div className="es-footer-brand">
            <BrandMark />
            <p>
              Travel eSIM plans with clear data, validity, and pricing. Browse the demo
              catalogue, compare plans, and follow the complete customer journey.
            </p>
            <span className="es-footer-badge">
              {demoMode ? "Demo build · no live integrations" : "No live supplier orders"}
            </span>
            <span className="es-footer-badge">English (EN)</span>
          </div>

          <nav className="es-footer-nav" aria-label="Footer navigation">
            {footerGroups.map((group) => (
              <div key={group.title} className="es-footer-group">
                <h2>{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="es-footer-bottom">
          <div className="es-footer-legal">
            <p>
              © {year} {businessName || "Esimprove demonstration storefront"}.
              {businessComplete ? (
                <>
                  {" "}
                  {legalSettings.legalName ? `Legal name: ${legalSettings.legalName}. ` : ""}
                  {address ? `${address}. ` : ""}
                  {legalSettings.businessCountry ? `${legalSettings.businessCountry}. ` : ""}
                  {legalSettings.registrationNumber
                    ? `Registration: ${legalSettings.registrationNumber}. `
                    : ""}
                  {legalSettings.vatNumber ? `VAT/tax: ${legalSettings.vatNumber}.` : ""}
                </>
              ) : (
                " Verified legal entity, registered address, registration number, and support telephone details are not configured in this build."
              )}
            </p>
            {supportEmail || privacyEmail ? (
              <p className="small">
                {supportEmail ? (
                  <>
                    Support: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.{" "}
                  </>
                ) : null}
                {privacyEmail ? (
                  <>
                    Privacy: <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="es-footer-bottom-links">
            <CookieSettingsButton className="es-footer-link-button" />
            <Link href="/privacy/request">Privacy request</Link>
            <Link href="/legal/accessibility">Accessibility</Link>
            <Link href="/#demo-limits">Demo limits</Link>
            <Link href="/api/health">System status</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
