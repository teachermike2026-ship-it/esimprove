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

const REQUEST_TYPES = [
  { value: "access", label: "Access to my personal data" },
  { value: "correction", label: "Correct inaccurate data" },
  { value: "deletion", label: "Delete my account or personal data" },
  { value: "restriction", label: "Restrict how my data is used" },
  { value: "portability", label: "Receive a portable copy" },
  { value: "objection", label: "Object to a processing activity" },
  { value: "other", label: "Another privacy request" },
];

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
              <strong>Request recorded.</strong>{" "}
              {state.reference ? (
                <>
                  Your reference is <code>{state.reference}</code>.
                </>
              ) : (
                "Your submission was received."
              )}
            </p>
            {state.status ? <p className="small">Current status: {state.status}.</p> : null}
            {state.message ? <p className="small">{state.message}</p> : null}
            <p className="small">
              Keep the reference and the email address used. You can check progress with the
              status lookup below.
            </p>
          </div>
        </div>
      ) : null}

      <form className="form card" action={formAction}>
        <ErrorMessage error={state.error} />
        <div className="field">
          <label htmlFor="privacy-request-type">What are you asking for?</label>
          <select id="privacy-request-type" name="requestType" required defaultValue="access">
            {REQUEST_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="privacy-request-name">Name (optional)</label>
          <input
            id="privacy-request-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="privacy-request-email">Email used for the account or order</label>
          <input
            id="privacy-request-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={defaultEmail}
          />
          <p className="form-note">
            Use the same address the account or order uses. A request with a different address
            cannot be matched to an account automatically.
          </p>
        </div>
        <div className="field">
          <label htmlFor="privacy-request-details">Details (optional)</label>
          <textarea
            id="privacy-request-details"
            name="details"
            rows={5}
            maxLength={4000}
            placeholder="Tell us what you need. Do not include passwords, one-time codes, or full card numbers."
          />
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="privacy-request-website">Leave this field empty</label>
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
            I understand this request is recorded for administrator review, that identity may
            need to be verified, and that financial or audit records may be retained where the law
            requires it. See the <Link href="/legal/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <button className="button" type="submit" disabled={pending}>
          <LockIcon className="inline-icon" />
          {pending ? "Recording request…" : "Submit privacy request"}
        </button>
        <p className="form-note">
          Submitting the form records your request; no confirmation email is sent automatically.
          Keep the reference you receive and check the status below.
        </p>
      </form>
    </div>
  );
}

export function PrivacyRequestLookupForm() {
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
              <strong>Request {state.reference}</strong>
            </p>
            <dl className="meta-list">
              <div>
                <dt>Type</dt>
                <dd>{state.requestType}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{state.status}</dd>
              </div>
              <div>
                <dt>Identity</dt>
                <dd>{state.verified ? "Verified" : "Verification pending"}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{state.createdAt} (UTC)</dd>
              </div>
              <div>
                <dt>Last update</dt>
                <dd>{state.updatedAt} (UTC)</dd>
              </div>
              {state.resolution ? (
                <div>
                  <dt>Resolution</dt>
                  <dd>{state.resolution}</dd>
                </div>
              ) : null}
              {state.rejectionReason ? (
                <div>
                  <dt>Reason</dt>
                  <dd>{state.rejectionReason}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="privacy-lookup-reference">Request reference</label>
        <input
          id="privacy-lookup-reference"
          name="reference"
          type="text"
          required
          maxLength={40}
          placeholder="PR-YYYYMM-XXXXXXXX"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="privacy-lookup-email">Email used for the request</label>
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
        {pending ? "Checking…" : "Check request status"}
      </button>
      <p className="form-note">
        Both the reference and the matching email are required. This prevents someone else from
        viewing your request by guessing a reference.
      </p>
    </form>
  );
}
