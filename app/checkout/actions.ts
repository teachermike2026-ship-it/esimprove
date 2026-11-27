"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { readCartToken } from "@/lib/cart-session";
import { createCheckout, CheckoutError } from "@/lib/checkout";
import { checkoutSchema, formString, zodMessage } from "@/lib/validation";
import { LEGAL_DOCUMENT_VERSION } from "@/lib/legal-profile";
import { recordConsent } from "@/lib/consents";
import { recordConsentEvent } from "@/lib/consent";
import { rememberGuestOrder } from "@/lib/guest-orders";
import { isCheckoutPaymentMethod } from "@/lib/checkout-payment";
import { onlineCheckoutAvailable, paymentProviderKey } from "@/lib/config";

type CheckoutState = { error?: string };

/** PostgreSQL "undefined_table" / "undefined_column" (pending migrations). */
function isMissingDatabaseObject(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 4; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === "42P01" || candidate.code === "42703") return true;
    if (
      typeof candidate.message === "string" &&
      /relation "[^"]+" does not exist|column "[^"]+" does not exist/i.test(candidate.message)
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export async function createCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  // Defence in depth for the local checkout UI preview. The preview button is
  // disabled, but a Server Action is a public POST endpoint, so reject any
  // preview submission before touching the cart, database, or payment adapter.
  if (formString(formData, "previewOnly") === "1") {
    return {
      error:
        "This is a local checkout UI preview. No order was created, no payment provider was contacted, and no database record was written.",
    };
  }

  // No email, name or country: guests stay anonymous, and a signed-in
  // customer's details come from their account (never from the form).
  const parsed = checkoutSchema.safeParse({
    terms: formString(formData, "terms"),
    immediateSupply: formString(formData, "immediateSupply"),
    termsVersion: formString(formData, "termsVersion"),
    idempotencyKey: formString(formData, "idempotencyKey"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const cartToken = await readCartToken();
  if (!cartToken) return { error: "Your cart is empty. Add a plan first." };

  const requestedMethod = formString(formData, "paymentMethod");
  if (requestedMethod !== "" && !isCheckoutPaymentMethod(requestedMethod)) {
    return { error: "Select a valid payment method." };
  }
  const paymentMethod = isCheckoutPaymentMethod(requestedMethod) ? requestedMethod : "card";
  // The card UI is disabled until Whop is configured; enforce the same rule
  // here because a Server Action can be called directly. This reads config
  // only and never contacts Whop.
  if (
    paymentMethod === "card" &&
    !(paymentProviderKey() === "whop" && onlineCheckoutAvailable())
  ) {
    return { error: "Card payments are coming soon. Please pay with crypto (USDT BEP-20)." };
  }

  const db = await getDb();
  if (parsed.data.termsVersion !== LEGAL_DOCUMENT_VERSION) {
    return {
      error:
        "The Terms of Service changed while this form was open. Reload the page and review the current version before continuing.",
    };
  }
  const user = await getCurrentUser();
  let redirectUrl: string;
  try {
    const result = await createCheckout(db, {
      cartToken,
      email: user?.email ?? null,
      name: user?.name ?? null,
      country: null,
      idempotencyKey: parsed.data.idempotencyKey,
      userId: user?.id ?? null,
      termsVersion: LEGAL_DOCUMENT_VERSION,
      paymentMethod,
    });
    redirectUrl = result.redirectUrl;

    // Evidence of the express request for immediate supply and the
    // acknowledgement about the withdrawal right, linked to the order.
    await recordConsentEvent(db, {
      subjectType: "order",
      subjectId: result.orderId,
      purpose: "immediate_supply_withdrawal_ack",
      version: LEGAL_DOCUMENT_VERSION,
      granted: true,
      surface: "checkout",
    });

    if (user) {
      await recordConsent(db, {
        userId: user.id,
        purpose: "terms",
        version: LEGAL_DOCUMENT_VERSION,
        accepted: true,
        surface: "checkout",
      });
    } else {
      // Guests have no account or email: the acceptance is linked to the
      // order itself, with the document version and time.
      await recordConsentEvent(db, {
        subjectType: "order",
        subjectId: result.orderId,
        purpose: "checkout_terms",
        version: LEGAL_DOCUMENT_VERSION,
        granted: true,
        surface: "checkout",
      });
      // Lets this device reopen the order later without an account.
      await rememberGuestOrder({ orderNumber: result.orderNumber, token: result.accessToken });
    }
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    console.error("checkout failed", error);
    if (isMissingDatabaseObject(error)) {
      // Seen locally when a long-running dev server opened its PGlite
      // database before new migrations (for example 0010 crypto_payments)
      // existed. Migrations run once when the server starts.
      return {
        error:
          "The checkout database is missing the latest update. Restart the server (or run npm run db:migrate) and try again. No payment was taken.",
      };
    }
    return {
      error: "The checkout could not be created. No payment was taken. Please try again in a moment.",
    };
  }

  redirect(redirectUrl);
}
