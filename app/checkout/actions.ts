"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { readCartToken } from "@/lib/cart-session";
import { createCheckout, CheckoutError } from "@/lib/checkout";
import { checkoutSchema, formString, normalizeEmail, zodMessage } from "@/lib/validation";
import { loadLegalSettings } from "@/lib/legal";
import { recordConsent } from "@/lib/consents";
import { recordConsentEvent } from "@/lib/consent";
import { hashToken } from "@/lib/crypto";

type CheckoutState = { error?: string };

export async function createCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse({
    email: formString(formData, "email"),
    name: formString(formData, "name"),
    country: formString(formData, "country"),
    terms: formString(formData, "terms"),
    termsVersion: formString(formData, "termsVersion"),
    idempotencyKey: formString(formData, "idempotencyKey"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const cartToken = await readCartToken();
  if (!cartToken) return { error: "Your cart is empty. Add a demo plan first." };

  const db = await getDb();
  const legal = await loadLegalSettings(db);
  if (parsed.data.termsVersion !== legal.termsVersion) {
    return {
      error:
        "The Terms of Service changed while this form was open. Reload the page and review the current version before continuing.",
    };
  }
  const user = await getCurrentUser();
  let paymentId: string;
  let accessToken: string;
  try {
    const result = await createCheckout(db, {
      cartToken,
      email: parsed.data.email,
      name: parsed.data.name,
      country: parsed.data.country,
      idempotencyKey: parsed.data.idempotencyKey,
      userId: user?.id ?? null,
      termsVersion: legal.termsVersion,
    });
    paymentId = result.paymentId;
    accessToken = result.accessToken;

    if (user) {
      await recordConsent(db, {
        userId: user.id,
        purpose: "terms",
        version: legal.termsVersion,
        accepted: true,
        surface: "checkout",
      });
    } else {
      await recordConsentEvent(db, {
        subjectType: "anonymous",
        subjectId: `checkout:${hashToken(normalizeEmail(parsed.data.email))}`,
        purpose: "checkout_terms",
        version: legal.termsVersion,
        granted: true,
        surface: "checkout",
      });
    }
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    console.error("checkout failed", error);
    return {
      error: "The demo checkout could not be created. Check the server log and try again.",
    };
  }

  redirect(
    `/checkout/pay/${encodeURIComponent(paymentId)}?token=${encodeURIComponent(accessToken)}`,
  );
}
