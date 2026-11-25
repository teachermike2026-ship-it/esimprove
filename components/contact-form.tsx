"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitContactAction, type ContactFormState } from "@/app/contact/actions";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      <AlertIcon className="inline-icon" />
      {error}
    </p>
  );
}

export function ContactForm({ defaultEmail = "", defaultName = "" }: {
  defaultEmail?: string;
  defaultName?: string;
}) {
  const { t, href } = useI18n();
  const [state, formAction, pending] = useActionState<ContactFormState, FormData>(
    submitContactAction,
    {},
  );

  return (
    <div className="contact-form-stack">
      {state.ok ? (
        <div className="callout callout-success" role="status">
          <CheckIcon className="inline-icon" />
          <div>
            <p>
              <strong>{t("contact.received")}</strong>{" "}
              {state.ticketId ? (
                <>{t("contact.reference", { reference: state.ticketId })}</>
              ) : null}
            </p>
            {state.message ? <p className="small">{state.message}</p> : null}
          </div>
        </div>
      ) : null}

      <form className="form card" action={formAction}>
        <ErrorMessage error={state.error} />
        <div className="field">
          <label htmlFor="contact-name">{t("contact.nameOptional")}</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={120}
            defaultValue={defaultName}
          />
        </div>
        <div className="field">
          <label htmlFor="contact-email">{t("contact.emailReply")}</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={defaultEmail}
          />
          <p className="form-note">{t("contact.emailNote")}</p>
        </div>
        <div className="field">
          <label htmlFor="contact-subject">{t("contact.subject")}</label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            required
            minLength={3}
            maxLength={160}
          />
        </div>
        <div className="field">
          <label htmlFor="contact-message">{t("contact.message")}</label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            placeholder={t("contact.messagePlaceholder")}
          />
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="contact-website">{t("contact.honeypot")}</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" name="privacyNotice" required />
          <span>
            {t("contact.privacyPrefix")}{" "}
            <Link href={href("/legal/privacy")}>{t("contact.privacyLink")}</Link>
            {t("contact.privacySuffix")}
          </span>
        </label>
        <button className="button" type="submit" disabled={pending}>
          <MailIcon className="inline-icon" />
          {pending ? t("contact.sending") : t("contact.send")}
        </button>
      </form>
    </div>
  );
}
