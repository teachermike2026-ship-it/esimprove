import type { Metadata } from "next";
import Link from "next/link";
import { noIndex } from "@/lib/config";

export const metadata: Metadata = {
  title: "Legal FAQ",
  description:
    "Where to find answers about the demonstration storefront, legal drafts, privacy requests, and current limitations.",
  alternates: { canonical: "/legal/faq" },
  robots: noIndex
    ? { index: false, follow: false, nocache: true }
    : { index: true, follow: true },
};

const items = [
  {
    question: "Are the legal documents final?",
    answer:
      "No. The privacy, terms, refund, cookie, and accessibility pages are drafts based on what this build actually does. Business identity, jurisdiction, refund rules, and final wording still require owner and legal input.",
  },
  {
    question: "Does this site claim GDPR, CCPA, or WCAG compliance?",
    answer:
      "No. The site implements consent, privacy-request, retention, and accessibility measures, but it does not claim certification or legal compliance. Compliance depends on the final business, contracts, jurisdiction, and an independent review.",
  },
  {
    question: "Can I buy a live eSIM here?",
    answer:
      "No. The catalogue and checkout are demonstrations. No live payment is taken, no supplier is connected, and no real eSIM is provisioned or activated.",
  },
  {
    question: "How do I ask for my data or request deletion?",
    answer:
      "Use the privacy request form. Deletion requests that could affect an account require identity verification and administrator review. Financial and audit records may be retained where legally required.",
  },
  {
    question: "Is customer support live?",
    answer:
      "No. The contact form stores a local support ticket for administrator review, but no support inbox, chat, telephone line, or response-time promise is connected in this build.",
  },
  {
    question: "Where are the main product FAQs?",
    answer:
      "The homepage FAQ covers eSIM basics, installation, compatibility, validity, hotspot use, and demo limitations. It does not claim live coverage or supplier relationships.",
  },
];

export default function LegalFaqPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">Legal &amp; compliance</p>
        <h1>Legal FAQ</h1>
        <p className="lead">
          Short answers about the status of the legal drafts and the limits of this demonstration
          build.
        </p>
      </header>

      <article className="card form prose legal-body">
        {items.map((item) => (
          <section key={item.question} aria-labelledby={item.question.replace(/\W+/g, "-")}>
            <h2 id={item.question.replace(/\W+/g, "-")}>{item.question}</h2>
            <p>{item.answer}</p>
          </section>
        ))}
        <p>
          See the <Link href="/legal">legal hub</Link>, the{" "}
          <Link href="/legal/privacy">privacy policy</Link>, the{" "}
          <Link href="/legal/refunds">refund draft</Link>, or the{" "}
          <Link href="/#faq">main FAQ</Link>.
        </p>
      </article>
    </div>
  );
}
