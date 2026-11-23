"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitContactAction, type ContactFormState } from "@/app/contact/actions";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";

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
              <strong>Message received.</strong>{" "}
              {state.ticketId ? (
                <>
                  Reference: <code>{state.ticketId}</code>. Keep it for your records.
                </>
              ) : null}
            </p>
            {state.message ? <p className="small">{state.message}</p> : null}
          </div>
        </div>
      ) : null}

      <form className="form card" action={formAction}>
        <ErrorMessage error={state.error} />
        <div className="field">
          <label htmlFor="contact-name">Name (optional)</label>
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
          <label htmlFor="contact-email">Email for a reply</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={defaultEmail}
          />
          <p className="form-note">
            If you are contacting us about an order, use the email address on the order so we can
            find it quickly.
          </p>
        </div>
        <div className="field">
          <label htmlFor="contact-subject">Subject</label>
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
          <label htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            placeholder="Describe the issue, the page or order involved, and what you have already tried. Do not include passwords, one-time codes, or full card numbers."
          />
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="contact-website">Leave this field empty</label>
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
            I understand that ESIMPROVE will use the details I provide to handle my request, as
            described in the <Link href="/legal/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <button className="button" type="submit" disabled={pending}>
          <MailIcon className="inline-icon" />
          {pending ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
