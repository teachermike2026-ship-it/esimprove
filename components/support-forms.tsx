"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createSupportTicketAction,
  replySupportTicketAction,
  type SupportFormState,
} from "@/app/portal/support/actions";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  type SupportCategory,
} from "@/lib/support";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";

function Feedback({ state }: { state: SupportFormState }) {
  if (state.error) {
    return (
      <div className="form-error" role="alert">
        <AlertIcon className="inline-icon" />
        <span>{state.error}</span>
      </div>
    );
  }
  if (state.ok) {
    return (
      <div className="callout callout-success" role="status">
        <CheckIcon className="inline-icon" />
        <div>
          <p>Your message was recorded.</p>
          {state.ticketId ? (
            <p className="small">
              Open <Link href={`/portal/support/${state.ticketId}`}>ticket {state.ticketId}</Link>{" "}
              to follow the conversation.
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  return null;
}

export function CreateSupportTicketForm({ defaultOrderNumber = "" }: { defaultOrderNumber?: string }) {
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(
    createSupportTicketAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="support-category">Category</label>
        <select id="support-category" name="category" defaultValue="general" required>
          {SUPPORT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {SUPPORT_CATEGORY_LABELS[category as SupportCategory]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="support-order">Related order number (optional)</label>
        <input
          id="support-order"
          name="orderNumber"
          type="text"
          maxLength={40}
          defaultValue={defaultOrderNumber}
          placeholder="ES-260101-ABCDEF"
        />
      </div>
      <div className="field">
        <label htmlFor="support-subject">Subject</label>
        <input
          id="support-subject"
          name="subject"
          type="text"
          required
          minLength={3}
          maxLength={160}
        />
      </div>
      <div className="field">
        <label htmlFor="support-message">Message</label>
        <textarea
          id="support-message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder="Describe the issue and what you already tried. Do not include passwords, one-time codes, or full card numbers."
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        <MailIcon className="inline-icon" />
        {pending ? "Recording ticket…" : "Open support ticket"}
      </button>
      <p className="form-note">
        The conversation is stored locally. No real email or live support response is generated
        unless a live email provider is configured.
      </p>
    </form>
  );
}

export function ReplySupportTicketForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(
    replySupportTicketAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <h2>Add a reply</h2>
      <Feedback state={state} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="field">
        <label htmlFor="support-reply">Reply</label>
        <textarea
          id="support-reply"
          name="message"
          required
          maxLength={4000}
          rows={4}
          placeholder="Add details for the support team."
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}
