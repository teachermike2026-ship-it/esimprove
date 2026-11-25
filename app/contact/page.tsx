import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ContactForm } from "@/components/contact-form";
import {
  ArrowRight,
  CheckIcon,
  HeadsetIcon,
  LockIcon,
  MailIcon,
} from "@/components/icons";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/contact",
    title: t("contact.metaTitle"),
    description: t("contact.metaDescription"),
  });
}

export default async function ContactPage() {
  const { t, href } = await getI18n();
  const helpRoutes = [
    {
      href: "/guides",
      title: t("contact.routeGuidesTitle"),
      description: t("contact.routeGuidesBody"),
    },
    {
      href: "/compatibility",
      title: t("contact.routeCompatibilityTitle"),
      description: t("contact.routeCompatibilityBody"),
    },
    {
      href: "/#faq",
      title: t("contact.routeFaqTitle"),
      description: t("contact.routeFaqBody"),
    },
    {
      href: "/legal/refunds",
      title: t("contact.routeRefundsTitle"),
      description: t("contact.routeRefundsBody"),
    },
  ];

  return (
    <div className="es-page">
      <section className="es-page-hero" aria-labelledby="contact-title">
        <p className="es-eyebrow">{t("contact.eyebrow")}</p>
        <h1 id="contact-title">
          {t("contact.title")} <span className="es-green">{t("contact.titleGreen")}</span>
        </h1>
        <p className="es-page-lead">
          {t("contact.lead", { email: LEGAL_CONTACT_EMAIL })}
        </p>
        <div className="es-page-actions">
          <Link className="es-button es-button-primary" href={href("/guides")}>
            {t("contact.guides")} <ArrowRight />
          </Link>
          <Link className="es-button es-button-secondary" href={href("/compatibility")}>
            {t("contact.checkDevice")}
          </Link>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="contact-form-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">{t("contact.formEyebrow")}</p>
          <h2 id="contact-form-title">{t("contact.formTitle")}</h2>
          <p>{t("contact.formBody")}</p>
        </div>
        <ContactFormSection />
      </section>

      <section className="es-page-section" aria-labelledby="support-status-title">
        <div className="es-support-status">
          <span className="es-support-status-icon">
            <HeadsetIcon />
          </span>
          <div>
            <p className="es-eyebrow">{t("contact.supportEyebrow")}</p>
            <h2 id="support-status-title">{t("contact.supportTitle")}</h2>
            <p>{t("contact.supportBody", { email: LEGAL_CONTACT_EMAIL })}</p>
          </div>
          <span className="es-status-pill" dir="ltr">
            <MailIcon /> {LEGAL_CONTACT_EMAIL}
          </span>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="help-routes-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">{t("contact.selfServiceEyebrow")}</p>
          <h2 id="help-routes-title">{t("contact.selfServiceTitle")}</h2>
          <p>{t("contact.selfServiceBody")}</p>
        </div>
        <div className="es-page-grid es-page-grid-2">
          {helpRoutes.map((route) => (
            <Link key={route.href} className="es-route-card" href={href(route.href)}>
              <span>
                <strong>{route.title}</strong>
                <small>{route.description}</small>
              </span>
              <ArrowRight />
            </Link>
          ))}
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="before-contact-title">
        <div className="es-page-split">
          <div className="es-static-card">
            <h3>
              <CheckIcon /> {t("contact.beforeTitle")}
            </h3>
            <ul className="es-check-list">
              <li>{t("contact.before1")}</li>
              <li>{t("contact.before2")}</li>
              <li>{t("contact.before3")}</li>
              <li>{t("contact.before4")}</li>
            </ul>
          </div>
          <div className="es-static-card">
            <h3>
              <MailIcon /> {t("contact.reachTitle")}
            </h3>
            <ul className="es-check-list">
              <li>{t("contact.reach1", { email: LEGAL_CONTACT_EMAIL })}</li>
              <li>{t("contact.reach2")}</li>
              <li>{t("contact.reach3")}</li>
              <li>{t("contact.reach4")}</li>
            </ul>
            <p className="es-muted-note">
              <LockIcon /> {t("contact.securityNote")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

async function ContactFormSection() {
  const user = await getCurrentUser();
  return (
    <ContactForm defaultEmail={user?.email ?? ""} defaultName={user?.name ?? ""} />
  );
}
