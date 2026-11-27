import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const { t, href } = await getI18n();
  const links = [
    { href: "/legal/privacy", label: t("legal.privacy") },
    { href: "/legal/terms", label: t("legal.terms") },
    { href: "/legal/refunds", label: t("legal.refunds") },
    { href: "/legal/payments", label: t("legal.payments") },
    { href: "/legal/esim-service", label: t("legal.esimService") },
    { href: "/legal/cookies", label: t("legal.cookies") },
    { href: "/legal/notice", label: t("legal.notice") },
    { href: "/legal/accessibility", label: t("legal.accessibility") },
    { href: "/privacy/request", label: t("common.privacyRequest") },
  ];

  return (
    <>
      <nav className="pill-row section-tight" aria-label={t("legal.documentsAria")}>
        {links.map((link) => (
          <Link key={link.href} className="badge badge-neutral" href={href(link.href)}>
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
