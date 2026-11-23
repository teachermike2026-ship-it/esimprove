"use client";

import { useActionState } from "react";
import { setNewOwnerPasswordAction } from "@/lib/auth/actions";
import { AlertIcon, LockIcon } from "@/components/icons";

type SetPasswordState = { error?: string; success?: boolean };

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(
    setNewOwnerPasswordAction,
    {},
  );

  return (
    <form className="form card" action={formAction}>
      {state.error ? (
        <div className="form-error" role="alert">
          <AlertIcon className="inline-icon" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="owner-new-password">New password</label>
        <input
          id="owner-new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          placeholder="At least 10 characters"
        />
      </div>
      <div className="field">
        <label htmlFor="owner-confirm-password">Confirm new password</label>
        <input
          id="owner-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        <LockIcon className="inline-icon" /> {pending ? "Saving…" : "Set new password"}
      </button>
      <p className="form-note">
        Your temporary password has been invalidated. After saving, you must sign in again with the
        new password.
      </p>
    </form>
  );
}
