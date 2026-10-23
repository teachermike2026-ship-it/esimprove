"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  loginAction,
  loginTwoFactorAction,
  registerAction,
} from "@/lib/auth/actions";
import { AlertIcon, LockIcon } from "@/components/icons";

type AuthState = { error?: string };

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
          Open your authenticator app and enter the current code. Demo operators can run
          <code>npm run totp</code> to print a local code.
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
          At least 10 characters. This demo does not send verification email.
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
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="form-note">
        Already have an account? <Link href="/login">Sign in</Link>.
      </p>
    </form>
  );
}
