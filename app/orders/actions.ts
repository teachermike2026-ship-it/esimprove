"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getOrderByNumber, verifyOrderAccessToken } from "@/lib/orders";
import {
  forgetGuestOrder,
  isPlausibleAccessToken,
  isPlausibleOrderNumber,
  parseOrderAccessInput,
  rememberGuestOrder,
} from "@/lib/guest-orders";
import { checkRateLimit, requestIpHash } from "@/lib/rate-limit";
import { formString } from "@/lib/validation";

export async function findGuestOrderAction(formData: FormData): Promise<void> {
  const db = await getDb();
  const rate = await checkRateLimit(db, `guest-order-find:${requestIpHash(await headers())}`, 10, 15 * 60);
  if (!rate.allowed) redirect("/orders?find=limited");

  const parsed = parseOrderAccessInput(
    formString(formData, "access").slice(0, 2048),
    formString(formData, "orderNumber").slice(0, 60),
  );
  if (!parsed) redirect("/orders?find=notfound");
  const order = await getOrderByNumber(db, parsed.orderNumber);
  // Same answer for "no such order" and "wrong code": nothing to probe.
  if (!order || !(await verifyOrderAccessToken(db, order.id, parsed.token))) {
    redirect("/orders?find=notfound");
  }
  await rememberGuestOrder({ orderNumber: order.orderNumber, token: parsed.token });
  redirect(`/orders/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(parsed.token)}`);
}

/** Keeps a verified guest order on this device's list. */
export async function rememberGuestOrderAction(formData: FormData): Promise<void> {
  const orderNumber = formString(formData, "orderNumber").slice(0, 60);
  const token = formString(formData, "token").slice(0, 200);
  if (!isPlausibleOrderNumber(orderNumber) || !isPlausibleAccessToken(token)) redirect("/orders");
  const db = await getDb();
  const order = await getOrderByNumber(db, orderNumber);
  if (!order || !(await verifyOrderAccessToken(db, order.id, token))) redirect("/orders?find=notfound");
  await rememberGuestOrder({ orderNumber, token });
  redirect(`/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}&saved=1`);
}

export async function forgetGuestOrderAction(formData: FormData): Promise<void> {
  const orderNumber = formString(formData, "orderNumber").slice(0, 60);
  if (isPlausibleOrderNumber(orderNumber)) await forgetGuestOrder(orderNumber);
  redirect("/orders");
}
