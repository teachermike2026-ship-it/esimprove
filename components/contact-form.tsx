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
              <strong>Message recorded.</strong>{" "}
              {state.ticketId ? (
                <>
                  Local ticket reference: <code>{state.ticketId}</code>.
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
            This build does not send email. The address is stored on the local support ticket so an
            administrator can identify the requester.
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
            I understand this message is stored as a local support ticket for administrator review
            and that no email or live support response is generated in this build. See the{" "}
            <Link href="/legal/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <button className="button" type="submit" disabled={pending}>
          <MailIcon className="inline-icon" />
          {pending ? "Recording message…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
