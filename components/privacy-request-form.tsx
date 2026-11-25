"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  lookupPrivacyRequestAction,
  submitPrivacyRequestAction,
  type PrivacyLookupState,
  type PrivacyRequestFormState,
} from "@/app/privacy/request/actions";
import { AlertIcon, CheckIcon, LockIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { statusLabel } from "@/lib/i18n/status";

const REQUEST_TYPES = [
  { value: "access", key: "privacyRequest.typeAccess" },
  { value: "correction", key: "privacyRequest.typeCorrection" },
  { value: "deletion", key: "privacyRequest.typeDeletion" },
  { value: "restriction", key: "privacyRequest.typeRestriction" },
  { value: "portability", key: "privacyRequest.typePortability" },
  { value: "objection", key: "privacyRequest.typeObjection" },
  { value: "other", key: "privacyRequest.typeOther" },
] as const;

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      <AlertIcon className="inline-icon" />
      {error}
    </p>
  );
}

export function PrivacyRequestForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const { t, href } = useI18n();
  const [state, formAction, pending] = useActionState<PrivacyRequestFormState, FormData>(
    submitPrivacyRequestAction,
    {},
  );

  return (
    <div className="privacy-form-stack">
      {state.ok ? (
        <div className="callout callout-success" role="status">
          <CheckIcon className="inline-icon" />
          <div>
            <p>
              <strong>{t("privacyRequest.recorded")}</strong>{" "}
              {state.reference
                ? t("privacyRequest.referenceInline", { reference: state.reference })
                : t("privacyRequest.submissionReceived")}
            </p>
            {state.status ? (
              <p className="small">
                {t("privacyRequest.currentStatus", { status: statusLabel(t, state.status) })}
              </p>
            ) : null}
            {state.message ? <p className="small">{state.message}</p> : null}
            <p className="small">{t("privacyRequest.keepReference")}</p>
          </div>
        </div>
      ) : null}

      <form className="form card" action={formAction}>
        <ErrorMessage error={state.error} />
        <div className="field">
          <label htmlFor="privacy-request-type">{t("privacyRequest.typeLabel")}</label>
          <select id="privacy-request-type" name="requestType" required defaultValue="access">
            {REQUEST_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {t(type.key)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="privacy-request-name">{t("privacyRequest.nameOptional")}</label>
          <input
            id="privacy-request-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="privacy-request-email">{t("privacyRequest.emailLabel")}</label>
          <input
            id="privacy-request-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={defaultEmail}
          />
          <p className="form-note">{t("privacyRequest.emailNote")}</p>
        </div>
        <div className="field">
          <label htmlFor="privacy-request-details">{t("privacyRequest.formDetailsLabel")}</label>
          <textarea
            id="privacy-request-details"
            name="details"
            rows={5}
            maxLength={4000}
            placeholder={t("privacyRequest.detailsPlaceholder")}
          />
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="privacy-request-website">{t("privacyRequest.honeypot")}</label>
          <input
            id="privacy-request-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" name="privacyNotice" required />
          <span>
            {t("privacyRequest.confirmDetailed")}{" "}
            <Link href={href("/legal/privacy")}>{t("privacyRequest.privacyLink")}</Link>
            .
          </span>
        </label>
        <button className="button" type="submit" disabled={pending}>
          <LockIcon className="inline-icon" />
          {pending ? t("privacyRequest.recording") : t("privacyRequest.submitPrivacy")}
        </button>
        <p className="form-note">{t("privacyRequest.noEmailSent")}</p>
      </form>
    </div>
  );
}

export function PrivacyRequestLookupForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<PrivacyLookupState, FormData>(
    lookupPrivacyRequestAction,
    {},
  );

  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      {state.ok ? (
        <div className="callout callout-success" role="status">
          <CheckIcon className="inline-icon" />
          <div>
            <p>
              <strong>
                {t("privacyRequest.lookupRequest", { reference: state.reference ?? "—" })}
              </strong>
            </p>
            <dl className="meta-list">
              <div>
                <dt>{t("privacyRequest.lookupType")}</dt>
                <dd>{state.requestType ? t(`privacyRequest.${state.requestType}`) : "—"}</dd>
              </div>
              <div>
                <dt>{t("privacyRequest.lookupStatus")}</dt>
                <dd>{state.status ? statusLabel(t, state.status) : "—"}</dd>
              </div>
              <div>
                <dt>{t("privacyRequest.lookupIdentity")}</dt>
                <dd>
                  {state.verified
                    ? t("privacyRequest.identityVerified")
                    : t("privacyRequest.identityPending")}
                </dd>
              </div>
              <div>
                <dt>{t("privacyRequest.lookupCreated")}</dt>
                <dd>
                  {state.createdAt} (UTC)
                </dd>
              </div>
              <div>
                <dt>{t("privacyRequest.lookupUpdated")}</dt>
                <dd>
                  {state.updatedAt} (UTC)
                </dd>
              </div>
              {state.resolution ? (
                <div>
                  <dt>{t("privacyRequest.lookupResolution")}</dt>
                  <dd>{state.resolution}</dd>
                </div>
              ) : null}
              {state.rejectionReason ? (
                <div>
                  <dt>{t("privacyRequest.lookupReason")}</dt>
                  <dd>{state.rejectionReason}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="privacy-lookup-reference">{t("privacyRequest.referenceLabel")}</label>
        <input
          id="privacy-lookup-reference"
          name="reference"
          type="text"
          required
          maxLength={40}
          placeholder="PR-YYYYMM-XXXXXXXX"
          autoComplete="off"
          dir="ltr"
        />
      </div>
      <div className="field">
        <label htmlFor="privacy-lookup-email">{t("privacyRequest.lookupEmailLabel")}</label>
        <input
          id="privacy-lookup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      <button className="button button-ghost" type="submit" disabled={pending}>
        {pending ? t("privacyRequest.checking") : t("privacyRequest.checkStatus")}
      </button>
      <p className="form-note">{t("privacyRequest.lookupNote")}</p>
    </form>
  );
}
