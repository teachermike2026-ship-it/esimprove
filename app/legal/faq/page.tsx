import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-profile";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/legal/faq",
    title: t("legal.faq"),
    description: t("legal.faqDescription"),
  });
}

const items = [
  {
    question: "Are the legal documents current?",
    answer:
      "Yes. The terms, privacy, refund, cookie, accessibility, and legal FAQ pages are the current published versions of ESIMPROVE's legal documents and describe how the service works today.",
  },
  {
    question: "Does ESIMPROVE claim GDPR, CCPA, or WCAG certification?",
    answer:
      "No. ESIMPROVE implements consent, privacy-request, retention, and accessibility measures as part of the service, but it is not certified and does not claim regulatory approval. Mandatory consumer protection and privacy laws applicable in your country continue to apply.",
  },
  {
    question: "How do I buy an eSIM?",
    answer:
      "Browse the catalogue, choose a plan for your destination, and complete checkout. Your installation details become available in your account and by the contact email used for the order once the order is fulfilled.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Unused eSIMs that have not been installed, activated, or connected to a network are refundable. After activation, use, or connection, refunds are available only for the reasons described in the refund policy — for example provisioning failure, duplicate charges, or misdescription — or where mandatory consumer law in your country requires it.",
  },
  {
    question: "How do I ask for my data or request deletion?",
    answer:
      "Use the privacy request form. Deletion requests that could affect an account require identity verification. Financial and audit records may be retained where the law requires them.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Email contact@esimprove.com or use the contact page. Please include your order reference where relevant. There is no telephone support line.",
  },
  {
    question: "Where are the main product FAQs?",
    answer:
      "The homepage FAQ covers eSIM basics, installation, compatibility, validity, and hotspot use.",
  },
];

export default async function LegalFaqPage() {
  const { t, href } = await getI18n();
  return (
    <div className="legal-page">
      <header className="legal-header">
        <p className="eyebrow">{t("legal.eyebrow")}</p>
        <h1>{t("legal.faq")}</h1>
        <p className="lead">{t("legal.faqDescription")}</p>
      </header>

      <article className="card form prose legal-body">
        {items.map((item) => (
          <section key={item.question} aria-labelledby={item.question.replace(/\W+/g, "-")}>
            <h2 id={item.question.replace(/\W+/g, "-")}>{item.question}</h2>
            <p>{item.answer}</p>
          </section>
        ))}
        <p>
          <Link href={href("/legal")}>{t("legal.title")}</Link>
          {" · "}
          <Link href={href("/legal/privacy")}>{t("legal.privacy")}</Link>
          {" · "}
          <Link href={href("/legal/refunds")}>{t("legal.refunds")}</Link>
          {" · "}
          <Link href={href("/#faq")}>{t("footer.faq")}</Link>
          {" · "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} dir="ltr">
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </article>
    </div>
  );
}
