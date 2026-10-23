"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { readCartToken } from "@/lib/cart-session";
import { createCheckout, CheckoutError } from "@/lib/checkout";
import { checkoutSchema, formString, zodMessage } from "@/lib/validation";

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
    idempotencyKey: formString(formData, "idempotencyKey"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const cartToken = await readCartToken();
  if (!cartToken) return { error: "Your cart is empty. Add a demo plan first." };

  const db = await getDb();
  const user = await getCurrentUser();
  let paymentId: string;
  try {
    const result = await createCheckout(db, {
      cartToken,
      email: parsed.data.email,
      name: parsed.data.name,
      country: parsed.data.country,
      idempotencyKey: parsed.data.idempotencyKey,
      userId: user?.id ?? null,
    });
    paymentId = result.paymentId;
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    console.error("checkout failed", error);
    return {
      error: "The demo checkout could not be created. Check the server log and try again.",
    };
  }

  redirect(`/checkout/pay/${encodeURIComponent(paymentId)}`);
}
