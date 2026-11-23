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

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact ESIMPROVE for support, order questions, refunds, and privacy requests.",
  alternates: { canonical: "/contact" },
};

const helpRoutes = [
  {
    href: "/guides",
    title: "Installation guides",
    description: "Provider-neutral steps for checking a device and installing an eSIM.",
  },
  {
    href: "/compatibility",
    title: "Compatibility checker",
    description: "Start with your device model and confirm the result with the manufacturer.",
  },
  {
    href: "/#faq",
    title: "Frequently asked questions",
    description: "Answers about eSIMs, validity, hotspot use, calls, and refunds.",
  },
  {
    href: "/legal/refunds",
    title: "Refund policy",
    description: "When you can cancel or request a refund, and how to ask.",
  },
];

export default function ContactPage() {
  return (
    <div className="es-page">
      <section className="es-page-hero" aria-labelledby="contact-title">
        <p className="es-eyebrow">Contact</p>
        <h1 id="contact-title">
          Let&apos;s talk <span className="es-green">connectivity.</span>
        </h1>
        <p className="es-page-lead">
          Questions about an order, an eSIM, or a refund? Send us a message using the form below
          or email <a href="mailto:contact@esimprove.com">contact@esimprove.com</a>. Please
          include your order reference so we can help quickly.
        </p>
        <div className="es-page-actions">
          <Link className="es-button es-button-primary" href="/guides">
            Use the installation guides <ArrowRight />
          </Link>
          <Link className="es-button es-button-secondary" href="/compatibility">
            Check your device
          </Link>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="contact-form-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">Message form</p>
          <h2 id="contact-form-title">Send us a message</h2>
          <p>
            Tell us what happened and include your order reference where relevant. We aim to
            respond as soon as reasonably possible; no specific response time is promised. Do not
            include passwords, one-time codes, or full payment card numbers.
          </p>
        </div>
        <ContactFormSection />
      </section>

      <section className="es-page-section" aria-labelledby="support-status-title">
        <div className="es-support-status">
          <span className="es-support-status-icon">
            <HeadsetIcon />
          </span>
          <div>
            <p className="es-eyebrow">Customer support</p>
            <h2 id="support-status-title">Support by email</h2>
            <p>
              Contact us at{" "}
              <a href="mailto:contact@esimprove.com">contact@esimprove.com</a>. ESIMPROVE
              operates online and has no telephone support line.
            </p>
          </div>
          <span className="es-status-pill">
            <MailIcon /> contact@esimprove.com
          </span>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="help-routes-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">Self-service</p>
          <h2 id="help-routes-title">Where to find answers now</h2>
          <p>
            These routes are provider-neutral guidance rather than claims about a specific
            supplier.
          </p>
        </div>
        <div className="es-page-grid es-page-grid-2">
          {helpRoutes.map((route) => (
            <Link key={route.href} className="es-route-card" href={route.href}>
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
              <CheckIcon /> Before you write to us
            </h3>
            <ul className="es-check-list">
              <li>Confirm your device supports eSIM and is carrier-unlocked.</li>
              <li>Keep your order reference and activation details together.</li>
              <li>Do not repeatedly scan or delete an eSIM during installation.</li>
              <li>Review the refund policy before assuming eligibility.</li>
            </ul>
          </div>
          <div className="es-static-card">
            <h3>
              <MailIcon /> How to reach us
            </h3>
            <ul className="es-check-list">
              <li>Email <a href="mailto:contact@esimprove.com">contact@esimprove.com</a> or use the form above.</li>
              <li>Include your order reference and the email address used for the order.</li>
              <li>For privacy requests, use the privacy request form — it handles access, correction, deletion, and more.</li>
              <li>There is no telephone line or live chat at this time.</li>
            </ul>
            <p className="es-muted-note">
              <LockIcon /> Never share passwords, one-time codes, or full card numbers. We will
              never ask for them.
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
