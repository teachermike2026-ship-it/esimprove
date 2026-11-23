"use client";

import { useActionState } from "react";
import { createCheckoutAction } from "@/app/checkout/actions";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal-profile";
import { AlertIcon, CreditCardIcon, LockIcon } from "@/components/icons";

type CheckoutState = { error?: string };

export function CheckoutForm({
  idempotencyKey,
  defaultEmail = "",
  defaultName = "",
  disabled = false,
}: {
  idempotencyKey: string;
  defaultEmail?: string;
  defaultName?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    createCheckoutAction,
    {},
  );

  return (
    <form className="form card checkout-form" action={formAction}>
      {state.error ? (
        <div className="form-error" role="alert">
          <AlertIcon className="inline-icon" />
          <span>{state.error}</span>
        </div>
      ) : null}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="termsVersion" value={LEGAL_DOCUMENT_VERSION} />
      <div className="field">
        <label htmlFor="checkout-email">Email for the order</label>
        <input
          id="checkout-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
          maxLength={254}
        />
      </div>
      <div className="field">
        <label htmlFor="checkout-name">Name on the order</label>
        <input
          id="checkout-name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={defaultName}
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="field">
        <label htmlFor="checkout-country">Country of residence</label>
        <select id="checkout-country" name="country" required defaultValue="US">
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="CA">Canada</option>
          <option value="AU">Australia</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="ES">Spain</option>
          <option value="IT">Italy</option>
          <option value="JP">Japan</option>
          <option value="OTHER">Other / not listed</option>
        </select>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="terms" required />
        <span>
          I accept the{" "}
          <a href="/legal/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </a>{" "}
          (version {LEGAL_DOCUMENT_VERSION}) and acknowledge the{" "}
          <a href="/legal/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          . The total shown in the order summary is the amount due at the next step. No
          additional fees are added later.
        </span>
      </label>
      <button className="button button-wide" type="submit" disabled={pending || disabled}>
        <CreditCardIcon className="inline-icon" />
        {pending ? "Creating order…" : "Continue to payment"}
      </button>
      <p className="form-note">
        <LockIcon className="inline-icon" /> Prices and tax are confirmed before your order is
        placed.
      </p>
    </form>
  );
}
