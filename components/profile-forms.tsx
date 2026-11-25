"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateProfileAction,
  type ProfileFormState,
} from "@/app/portal/profile/actions";
import { requestEmailVerificationAction } from "@/lib/auth/actions";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

function Feedback({ state }: { state: ProfileFormState }) {
  const { t } = useI18n();
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
        <p>{t("profile.saved")}</p>
      </div>
    );
  }
  return null;
}

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Français" },
];

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
  const { t, href } = useI18n();
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <h2>{t("profile.formTitle")}</h2>
      <Feedback state={state} />
      <div className="field">
        <label htmlFor="profile-name">{t("profile.name")}</label>
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
        <label htmlFor="profile-locale">{t("profile.preferredLanguage")}</label>
        <select id="profile-locale" name="locale" defaultValue={locale}>
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="form-note">{t("profile.languageNote")}</p>
      </div>
      <fieldset className="field">
        <legend>{t("profile.emailPreferences")}</legend>
        <label className="checkbox">
          <input type="checkbox" name="orderUpdates" defaultChecked={orderUpdatesOptIn} />
          <span>{t("profile.orderUpdates")}</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" name="productUpdates" defaultChecked={productUpdatesOptIn} />
          <span>{t("profile.productUpdates")}</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" name="marketing" defaultChecked={marketingOptIn} />
          <span>{t("profile.marketing")}</span>
        </label>
      </fieldset>
      <p className="form-note">
        {t("profile.emailPreferencesNote")}{" "}
        <Link href={href("/legal/privacy")}>{t("profile.privacyPolicyLink")}</Link>.
      </p>
      <button className="button" type="submit" disabled={pending}>
        {pending ? t("profile.saving") : t("profile.saveProfile")}
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
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (verified) {
    return (
      <div className="callout callout-success" role="status">
        <CheckIcon className="inline-icon" />
        <p>{t("profile.emailVerifiedBody")}</p>
      </div>
    );
  }

  return (
    <div className="stack-sm">
      <p className="muted small">{t("profile.emailNotVerifiedBody")}</p>
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
                : { ok: true, text: t("profile.verificationRecorded", { email }) },
            );
          });
        }}
      >
        <MailIcon className="inline-icon" />
        {pending ? t("profile.recording") : t("profile.sendVerification")}
      </button>
      {message ? (
        <p className={message.ok ? "form-note" : "form-error"} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
