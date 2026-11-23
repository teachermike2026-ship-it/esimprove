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
  const [state, formAction, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="login-email">Email</label>
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
        <label htmlFor="login-password">Password</label>
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="form-note">
        New here? <Link href="/register">Create a customer account</Link>. Admin accounts
        require TOTP after the password step.
      </p>
    </form>
  );
}

export function TwoFactorForm({ next = "/admin" }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    loginTwoFactorAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="totp-code">6-digit authenticator code</label>
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
          Open your authenticator app and enter the current 6-digit code.
        </p>
      </div>
      <button className="button" type="submit" disabled={pending}>
        <LockIcon className="inline-icon" />
        {pending ? "Verifying…" : "Verify and continue"}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(registerAction, {});
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION} />
      <input type="hidden" name="privacyVersion" value={LEGAL_DOCUMENT_VERSION} />
      <div className="field">
        <label htmlFor="register-name">Name</label>
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
        <label htmlFor="register-email">Email</label>
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
        <label htmlFor="register-password">Password</label>
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
          At least 10 characters. This build does not send verification email.
        </p>
      </div>
      <div className="field">
        <label htmlFor="register-confirm">Confirm password</label>
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
          I accept the{" "}
          <Link href="/legal/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </Link>{" "}
          (version {LEGAL_DOCUMENT_VERSION}).
        </span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="privacy" required />
        <span>
          I acknowledge the{" "}
          <Link href="/legal/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </Link>{" "}
          and understand how account, order, and support data is used.
        </span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="age" required />
        <span>
          I confirm that I am old enough to enter a binding contract where I live, or that a
          parent or guardian has agreed to this account. The site is not directed at children.
        </span>
      </label>
      <label className="checkbox">
        <input type="checkbox" name="marketing" />
        <span>
          Send me optional product and travel updates by email. This is not required to create
          an account or place an order, and I can unsubscribe at any time. See the{" "}
          <Link href="/legal/privacy">Privacy Policy</Link>.
        </span>
      </label>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="form-note">
        Already have an account? <Link href="/login">Sign in</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordResetState, FormData>(
    requestPasswordResetAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      {state.success ? (
        <div className="callout">
          <p>
            If an account exists for that email, a password reset link has been generated. It
            expires in 30 minutes and can only be used once.
          </p>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="forgot-email">Email</label>
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
        {pending ? "Sending reset link…" : "Send password reset link"}
      </button>
      <p className="form-note">
        Remembered it? <Link href="/login">Back to sign in</Link>.
      </p>
    </form>
  );
}

export function ResetPasswordForm({
  token = "",
}: {
  token?: string;
}) {
  const [state, formAction, pending] = useActionState<PasswordResetState, FormData>(
    resetPasswordAction,
    {},
  );
  if (!token) {
    return (
      <div className="callout">
        <p>Open a password reset link from your email to choose a new password.</p>
      </div>
    );
  }
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      {state.success ? (
        <div className="callout">
          <p>Your password has been reset. Sign in with the new password.</p>
        </div>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="reset-password">New password</label>
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
          At least 10 characters.
        </p>
      </div>
      <div className="field">
        <label htmlFor="reset-confirm">Confirm new password</label>
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
        {pending ? "Resetting password…" : "Reset password"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordChangeState, FormData>(
    changePasswordAction,
    {},
  );
  return (
    <form className="form card" action={formAction}>
      <ErrorMessage error={state.error} />
      {state.success ? (
        <div className="callout">
          <p>Your password has been changed. For security, all existing sessions were signed out.</p>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="change-current">Current password</label>
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
        <label htmlFor="change-new">New password</label>
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
          At least 10 characters.
        </p>
      </div>
      <div className="field">
        <label htmlFor="change-confirm">Confirm new password</label>
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
        {pending ? "Updating password…" : "Update password"}
      </button>
    </form>
  );
}
