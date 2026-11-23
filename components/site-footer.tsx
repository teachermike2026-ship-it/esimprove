import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { CookieSettingsButton } from "@/components/analytics-tracker";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";

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

export function SiteFooter() {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="es-footer">
      <div className="es-shell">
        <div className="es-footer-top">
          <div className="es-footer-brand">
            <BrandMark />
            <p>
              Travel eSIM plans with clear data, validity, and pricing. Browse the
              catalogue, compare plans, and follow the complete customer journey.
            </p>
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
              © {year} ESIMPROVE. Online digital services platform · Vietnam. ESIMPROVE is an
              online platform and brand, not a registered company; no registration number or VAT
              number is held or claimed.
            </p>
            <p className="small">
              Contact: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
            </p>
          </div>
          <div className="es-footer-bottom-links">
            <CookieSettingsButton className="es-footer-link-button" />
            <Link href="/privacy/request">Privacy request</Link>
            <Link href="/legal/accessibility">Accessibility</Link>
            <Link href="/api/health">System status</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
