"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { simulateMockPayment } from "@/lib/payments";
import { loadAuthorizedMockPayment } from "@/lib/payment-access";
import { getCartByToken, clearCart } from "@/lib/cart";
import { readCartToken, clearCartCookie } from "@/lib/cart-session";
import { formString } from "@/lib/validation";

function paymentUrl(paymentId: string, params: Record<string, string>, token: string): string {
  const query = new URLSearchParams(params);
  if (token) query.set("token", token);
  return `/checkout/pay/${encodeURIComponent(paymentId)}?${query.toString()}`;
}

export async function simulateSuccessAction(formData: FormData): Promise<void> {
  const paymentId = formString(formData, "paymentId");
  const token = formString(formData, "token");
  if (!paymentId) redirect("/cart");

  const db = await getDb();
  const authorized = await loadAuthorizedMockPayment(db, paymentId, token || null);
  if (!authorized) redirect("/cart");
  const { order } = authorized;

  try {
    await simulateMockPayment(db, paymentId, "success");
  } catch {
    redirect(paymentUrl(paymentId, { error: "Mock payment could not be completed." }, token));
  }

  const cartToken = await readCartToken();
  if (cartToken) {
    const cart = await getCartByToken(db, cartToken);
    if (cart) await clearCart(db, cart.id);
    await clearCartCookie();
  }
  const query = new URLSearchParams({ order: order.orderNumber });
  if (token) query.set("token", token);
  redirect(`/checkout/success?${query.toString()}`);
}

export async function simulateFailureAction(formData: FormData): Promise<void> {
  const paymentId = formString(formData, "paymentId");
  const token = formString(formData, "token");
  if (!paymentId) redirect("/cart");
  const db = await getDb();
  const authorized = await loadAuthorizedMockPayment(db, paymentId, token || null);
  if (!authorized) redirect("/cart");
  try {
    await simulateMockPayment(db, paymentId, "failure");
  } catch {
    redirect(paymentUrl(paymentId, { error: "Mock failure could not be recorded." }, token));
  }
  redirect(paymentUrl(paymentId, { failed: "1" }, token));
}
