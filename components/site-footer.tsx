import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { CookieSettingsButton } from "@/components/analytics-tracker";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localeDescriptors } from "@/lib/i18n/config";

export async function SiteFooter() {
  const { t, href, dir, locale } = await getI18n();
  const year = new Date().getUTCFullYear();
  const descriptor = localeDescriptors[locale];

  const footerGroups = [
    {
      titleKey: "footer.company",
      links: [
        { href: "/about", labelKey: "footer.about" },
        { href: "/contact", labelKey: "footer.contact" },
        { href: "/about#how-it-works", labelKey: "footer.howItWorks" },
      ],
    },
    {
      titleKey: "footer.destinations",
      links: [
        { href: "/destinations", labelKey: "footer.countries" },
        { href: "/regions", labelKey: "footer.regionalPlans" },
        { href: "/plans", labelKey: "footer.allPlans" },
        { href: "/compatibility", labelKey: "footer.compatibility" },
      ],
    },
    {
      titleKey: "footer.help",
      links: [
        { href: "/guides", labelKey: "footer.helpCentre" },
        { href: "/guides", labelKey: "footer.installationGuide" },
        { href: "/compatibility", labelKey: "footer.deviceCompatibility" },
        { href: "/#faq", labelKey: "footer.faq" },
      ],
    },
    {
      titleKey: "footer.legal",
      links: [
        { href: "/legal/terms", labelKey: "footer.terms" },
        { href: "/legal/privacy", labelKey: "footer.privacy" },
        { href: "/legal/refunds", labelKey: "footer.refunds" },
        { href: "/legal/cookies", labelKey: "footer.cookies" },
        { href: "/legal/accessibility", labelKey: "footer.accessibility" },
        { href: "/privacy/request", labelKey: "footer.privacyRequest" },
        { href: "/contact", labelKey: "footer.contactSupport" },
      ],
    },
    {
      titleKey: "footer.account",
      links: [
        { href: "/login", labelKey: "footer.signIn" },
        { href: "/register", labelKey: "footer.createAccount" },
        { href: "/portal", labelKey: "footer.myEsims" },
        { href: "/portal", labelKey: "footer.myOrders" },
      ],
    },
  ] as const;

  return (
    <footer className="es-footer" dir={dir}>
      <div className="es-shell">
        <div className="es-footer-top">
          <div className="es-footer-brand">
            <BrandMark href={href("/")} ariaLabel={t("nav.home")} />
            <p>{t("footer.description")}</p>
            <span className="es-footer-badge" lang={descriptor.code} dir="ltr">
              {descriptor.nativeName} ({descriptor.shortLabel})
            </span>
          </div>

          <nav className="es-footer-nav" aria-label={t("footer.footerNav")}>
            {footerGroups.map((group) => (
              <div key={group.titleKey} className="es-footer-group">
                <h2>{t(group.titleKey)}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={`${group.titleKey}-${link.labelKey}`}>
                      <Link href={href(link.href)}>{t(link.labelKey)}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="es-footer-bottom">
          <div className="es-footer-legal">
            <p>{t("footer.legalText", { year: String(year) })}</p>
            <p className="small">
              {t("footer.contactLabel")}{" "}
              <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} dir="ltr">
                {LEGAL_CONTACT_EMAIL}
              </a>
            </p>
          </div>
          <div className="es-footer-bottom-links">
            <CookieSettingsButton className="es-footer-link-button" />
            <Link href={href("/privacy/request")}>{t("footer.privacyRequest")}</Link>
            <Link href={href("/legal/accessibility")}>{t("footer.accessibility")}</Link>
            <Link href={href("/api/health")}>{t("common.systemStatus")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
