"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getPaymentById, simulateMockPayment } from "@/lib/payments";
import { createOrderAccessToken, getOrderById } from "@/lib/orders";
import { getCartByToken, clearCart } from "@/lib/cart";
import { readCartToken, clearCartCookie } from "@/lib/cart-session";
import { formString } from "@/lib/validation";

export async function simulateSuccessAction(formData: FormData): Promise<void> {
  const paymentId = formString(formData, "paymentId");
  if (!paymentId) redirect("/cart");

  const db = await getDb();
  const payment = await getPaymentById(db, paymentId);
  if (!payment) redirect("/cart");
  const order = await getOrderById(db, payment.orderId);
  if (!order) redirect("/cart");

  try {
    await simulateMockPayment(db, paymentId, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mock payment failed";
    redirect(`/checkout/pay/${encodeURIComponent(paymentId)}?error=${encodeURIComponent(message)}`);
  }

  const cartToken = await readCartToken();
  if (cartToken) {
    const cart = await getCartByToken(db, cartToken);
    if (cart) await clearCart(db, cart.id);
    await clearCartCookie();
  }
  const token = await createOrderAccessToken(db, order.id);
  redirect(
    `/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(token)}`,
  );
}

export async function simulateFailureAction(formData: FormData): Promise<void> {
  const paymentId = formString(formData, "paymentId");
  if (!paymentId) redirect("/cart");
  const db = await getDb();
  try {
    await simulateMockPayment(db, paymentId, "failure");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mock failure could not be recorded";
    redirect(`/checkout/pay/${encodeURIComponent(paymentId)}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/checkout/pay/${encodeURIComponent(paymentId)}?failed=1`);
}
