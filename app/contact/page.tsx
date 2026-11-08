import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ContactForm } from "@/components/contact-form";
import {
  AlertIcon,
  ArrowRight,
  CheckIcon,
  HeadsetIcon,
  LockIcon,
  MailIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact routes and honest support limitations for the Esimprove demo storefront. No live support channel is connected.",
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
    description: "Answers about eSIMs, validity, hotspot use, calls, refunds, and this demo.",
  },
  {
    href: "/legal/refunds",
    title: "Refund policy draft",
    description: "The current draft and the conditions that still require approval.",
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
          This demo does not run a live support desk. The contact form below stores a local
          support ticket for administrator review, but it does not send an email. There is no
          monitored inbox, telephone line, live chat, or response-time promise connected to this
          build.
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
          <h2 id="contact-form-title">Record a support message</h2>
          <p>
            The message is stored as a local support ticket visible in the administrator dashboard.
            No email is sent and no live response is promised. Do not include passwords, one-time
            codes, or full payment card numbers.
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
            <p className="es-eyebrow">Support status</p>
            <h2 id="support-status-title">Live customer support is not connected</h2>
            <p>
              A real support email, phone number, chat channel, and published service window
              must be staffed and verified before launch. None are invented on this page.
            </p>
          </div>
          <span className="es-status-pill">
            <AlertIcon /> Not live
          </span>
        </div>
      </section>

      <section className="es-page-section" aria-labelledby="help-routes-title">
        <div className="es-page-section-head">
          <p className="es-eyebrow">Self-service</p>
          <h2 id="help-routes-title">Where to find answers now</h2>
          <p>
            These routes are available in the demo and use provider-neutral guidance rather than
            claims about a specific supplier.
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
              <CheckIcon /> Before a real support channel exists
            </h3>
            <ul className="es-check-list">
              <li>Confirm your device supports eSIM and is carrier-unlocked.</li>
              <li>Keep your order reference and activation details together.</li>
              <li>Do not repeatedly scan or delete an eSIM during installation.</li>
              <li>Review the draft refund policy before assuming eligibility.</li>
            </ul>
          </div>
          <div className="es-static-card">
            <h3>
              <LockIcon /> What is intentionally missing
            </h3>
            <ul className="es-check-list">
              <li>No monitored support email inbox or live-chat widget.</li>
              <li>No telephone number or published service window.</li>
              <li>No office address, registration number, or social profiles.</li>
              <li>No response-time or 24/7 support promise.</li>
            </ul>
            <p className="es-muted-note">
              <MailIcon /> The contact form stores a local ticket only. Real staffed channels will
              appear only when they exist and are verified.
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
