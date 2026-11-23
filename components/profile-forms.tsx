"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateProfileAction,
  type ProfileFormState,
} from "@/app/portal/profile/actions";
import { requestEmailVerificationAction } from "@/lib/auth/actions";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";

function Feedback({ state }: { state: ProfileFormState }) {
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
        <p>Profile and communication preferences saved.</p>
      </div>
    );
  }
  return null;
}

export function ProfileForm({
  name,
  locale,
  marketingOptIn,
  productUpdatesOptIn,
  orderUpdatesOptIn,
}: {
  name: string;
  locale: string;
  marketingOptIn: boolean;
  productUpdatesOptIn: boolean;
  orderUpdatesOptIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <h2>Profile and preferences</h2>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="profile-name">Name</label>
        <input
          id="profile-name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
          autoComplete="name"
        />
      </div>
      <div className="field">
        <label htmlFor="profile-locale">Preferred language</label>
        <select id="profile-locale" name="locale" defaultValue={locale}>
          <option value="en">English</option>
          <option value="pt">Português</option>
          <option value="es">Español</option>
        </select>
        <p className="form-note">
          The site interface is currently available in English. Your language preference is saved
          and will apply as more languages become available.
        </p>
      </div>
      <fieldset className="field">
        <legend>Email preferences</legend>
        <label className="checkbox">
          <input
            type="checkbox"
            name="orderUpdates"
            defaultChecked={orderUpdatesOptIn}
          />
          <span>Order and fulfillment updates</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="productUpdates"
            defaultChecked={productUpdatesOptIn}
          />
          <span>Product and coverage updates</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" name="marketing" defaultChecked={marketingOptIn} />
          <span>Marketing email. You can withdraw this consent at any time.</span>
        </label>
      </fieldset>
      <p className="form-note">
        Your email preferences are saved to your account. No marketing email is sent without your
        consent. See the{" "}
        <Link href="/legal/privacy">privacy policy</Link> for details.
      </p>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function RequestVerificationButton({
  verified,
  email,
}: {
  verified: boolean;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (verified) {
    return (
      <div className="callout callout-success" role="status">
        <CheckIcon className="inline-icon" />
        <p>This account email address is verified.</p>
      </div>
    );
  }

  return (
    <div className="stack-sm">
      <p className="muted small">
        This address is not verified yet. Check your inbox for a verification email.
      </p>
      <button
        className="button button-secondary button-small"
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await requestEmailVerificationAction();
            setMessage(
              result.error
                ? { ok: false, text: result.error }
                : { ok: true, text: `Verification notice recorded for ${email}.` },
            );
          });
        }}
      >
        <MailIcon className="inline-icon" />
        {pending ? "Recording…" : "Send verification email"}
      </button>
      {message ? (
        <p className={message.ok ? "form-note" : "form-error"} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
