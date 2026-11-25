"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  changePasswordAction,
  loginAction,
  loginTwoFactorAction,
  registerAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/lib/auth/actions";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal-profile";
import { AlertIcon, LockIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

type AuthState = { error?: string };
type PasswordResetState = { error?: string; success?: boolean };
type PasswordChangeState = { error?: string; success?: boolean };

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert">
      <AlertIcon className="inline-icon" />
      <span>{error}</span>
    </div>
  );
}

export function LoginForm({ next = "" }: { next?: string }) {
  const { t, href } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="login-email">{t("auth.email")}</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">{t("auth.password")}</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={1}
          maxLength={200}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        <LockIcon className="inline-icon" />
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </button>
      <p className="form-note">
        {t("auth.newHere")}{" "}
        <Link href={href("/register")}>{t("auth.createCustomerAccount")}</Link>.{" "}
        {t("auth.adminTotpNote")}
      </p>
    </form>
  );
}

export function TwoFactorForm({ next = "/admin" }: { next?: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    loginTwoFactorAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="totp-code">{t("auth.sixDigitCode")}</label>
        <input
          id="totp-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          aria-describedby="totp-help"
        />
        <p id="totp-help" className="form-note">
          {t("auth.totpHelp")}
        </p>
      </div>
      <button className="button" type="submit" disabled={pending}>
        <LockIcon className="inline-icon" />
        {pending ? t("auth.verifying") : t("auth.verifyContinue")}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const { t, href } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(registerAction, {});
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION} />
      <input type="hidden" name="privacyVersion" value={LEGAL_DOCUMENT_VERSION} />
      <div className="field">
        <label htmlFor="register-name">{t("auth.name")}</label>
        <input
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="field">
        <label htmlFor="register-email">{t("auth.email")}</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      <div className="field">
        <label htmlFor="register-password">{t("auth.password")}</label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          aria-describedby="register-password-help"
        />
        <p id="register-password-help" className="form-note">
          {t("auth.passwordHelp")}
        </p>
      </div>
      <div className="field">
        <label htmlFor="register-confirm">{t("auth.confirmPassword")}</label>
        <input
          id="register-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
        />
      </div>
      <label className="checkbox">
        <input type="checkbox" name="terms" required />
        <span>
          {t("auth.termsPrefix")}{" "}
          <Link href={href("/legal/terms")} target="_blank" rel="noreferrer">
            {t("auth.termsLink")}
          </Link>{" "}
          {t("auth.termsSuffix", { version: LEGAL_DOCUMENT_VERSION })}
        </span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="privacy" required />
        <span>
          {t("auth.privacyPrefix")}{" "}
          <Link href={href("/legal/privacy")} target="_blank" rel="noreferrer">
            {t("auth.privacyLink")}
          </Link>{" "}
          {t("auth.privacySuffix")}
        </span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="age" required />
        <span>{t("auth.ageConfirm")}</span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="marketing" />
        <span>
          {t("auth.marketingPrefix")}{" "}
          <Link href={href("/legal/privacy")}>{t("auth.marketingLink")}</Link>
          {t("auth.marketingSuffix")}
        </span>
      </label>
      <button className="button" type="submit" disabled={pending}>
        {pending ? t("auth.creatingAccount") : t("auth.createAccount")}
      </button>
      <p className="form-note">
        {t("auth.alreadyHaveLink")} <Link href={href("/login")}>{t("auth.signInLink")}</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { t, href } = useI18n();
  const [state, formAction, pending] = useActionState<PasswordResetState, FormData>(
    requestPasswordResetAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      {state.success ? (
        <div className="callout">
          <p>{t("auth.forgotSuccess")}</p>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="forgot-email">{t("auth.email")}</label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        <LockIcon className="inline-icon" />
        {pending ? t("auth.sendingReset") : t("auth.sendReset")}
      </button>
      <p className="form-note">
        {t("auth.remembered")} <Link href={href("/login")}>{t("auth.backToSignIn")}</Link>.
      </p>
    </form>
  );
}

export function ResetPasswordForm({
  token = "",
}: {
  token?: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<PasswordResetState, FormData>(
    resetPasswordAction,
    {},
  );
  if (!token) {
    return (
      <div className="callout">
        <p>{t("auth.resetNoToken")}</p>
      </div>
    );
  }
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      {state.success ? (
        <div className="callout">
          <p>{t("auth.resetSuccess")}</p>
        </div>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="reset-password">{t("auth.newPassword")}</label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          aria-describedby="reset-password-help"
        />
        <p id="reset-password-help" className="form-note">
          {t("auth.resetHelp")}
        </p>
      </div>
      <div className="field">
        <label htmlFor="reset-confirm">{t("auth.confirmNewPassword")}</label>
        <input
          id="reset-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        <LockIcon className="inline-icon" />
        {pending ? t("auth.resettingPassword") : t("auth.resetPassword")}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<PasswordChangeState, FormData>(
    changePasswordAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      {state.success ? (
        <div className="callout">
          <p>{t("auth.changeSuccess")}</p>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="change-current">{t("auth.changeCurrent")}</label>
        <input
          id="change-current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
        />
      </div>
      <div className="field">
        <label htmlFor="change-new">{t("auth.changeNew")}</label>
        <input
          id="change-new"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          aria-describedby="change-new-help"
        />
        <p id="change-new-help" className="form-note">
          {t("auth.resetHelp")}
        </p>
      </div>
      <div className="field">
        <label htmlFor="change-confirm">{t("auth.changeConfirm")}</label>
        <input
          id="change-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        <LockIcon className="inline-icon" />
        {pending ? t("auth.updatingPassword") : t("auth.updatePassword")}
      </button>
    </form>
  );
}
