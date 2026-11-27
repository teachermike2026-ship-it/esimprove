"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createSupportTicketAction,
  replySupportTicketAction,
  type SupportFormState,
} from "@/app/portal/support/actions";
import { SUPPORT_CATEGORIES } from "@/lib/support-constants";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { supportCategoryLabel } from "@/lib/i18n/labels";

function Feedback({ state }: { state: SupportFormState }) {
  const { t, href } = useI18n();
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
          <p>{t("support.ticketRecorded")}</p>
          {state.ticketId ? (
            <p className="small">
              <Link href={href(`/portal/support/${state.ticketId}`)}>
                {t("support.openTicketLink", { id: state.ticketId })}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  return null;
}

export function CreateSupportTicketForm({
  defaultOrderNumber = "",
}: {
  defaultOrderNumber?: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(
    createSupportTicketAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="support-category">{t("support.category")}</label>
        <select id="support-category" name="category" defaultValue="general" required>
          {SUPPORT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {supportCategoryLabel(t, category)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="support-order">{t("support.relatedOrder")}</label>
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
        <label htmlFor="support-subject">{t("support.subject")}</label>
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
        <label htmlFor="support-message">{t("support.message")}</label>
        <textarea
          id="support-message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          placeholder={t("support.messagePlaceholder")}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        <MailIcon className="inline-icon" />
        {pending ? t("support.recordingTicket") : t("support.openTicket")}
      </button>
      <p className="form-note">{t("support.localNote")}</p>
    </form>
  );
}

export function ReplySupportTicketForm({ ticketId }: { ticketId: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(
    replySupportTicketAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <h2>{t("support.addReply")}</h2>
      <Feedback state={state} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="field">
        <label htmlFor="support-reply">{t("support.reply")}</label>
        <textarea
          id="support-reply"
          name="message"
          required
          maxLength={4000}
          rows={4}
          placeholder={t("support.replyPlaceholder")}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        {pending ? t("support.sending") : t("support.sendReply")}
      </button>
    </form>
  );
}
