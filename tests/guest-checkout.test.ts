/**
 * Guest checkout with zero personal information, secure guest order access,
 * and website delivery after a simulated verified payment. Mock payment and
 * mock supplier only: no Whop call, no blockchain transfer, no real eSIM.
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { cryptoPayments, emailEvents, orderAccessTokens, orders, plans, users } from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout, GUEST_ORDER_ACCESS_DAYS } from "@/lib/checkout";
import { simulateMockPayment } from "@/lib/payments";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { canViewOrder, getOrderItems } from "@/lib/orders";
import { buildActivation } from "@/lib/esim-activation";
import { checkoutSchema } from "@/lib/validation";
import {
  addGuestOrder,
  parseGuestOrders,
  parseOrderAccessInput,
  serializeGuestOrders,
} from "@/lib/guest-orders";
import { makeTestDb } from "./helpers/db";

const WALLET = "0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E";
const CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("checkout form validation", () => {
  const legal = { terms: "on", immediateSupply: "yes", termsVersion: "2.0", idempotencyKey: "checkout_abcdefghij" };

  it("needs no email, name or country", () => {
    const parsed = checkoutSchema.safeParse(legal);
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {})).not.toEqual(
      expect.arrayContaining(["email", "name", "country"]),
    );
  });

  it("still requires the legal acknowledgements (never pre-ticked)", () => {
    expect(checkoutSchema.safeParse({ ...legal, terms: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...legal, immediateSupply: "" }).success).toBe(false);
  });

  it("the checkout action and form no longer read or render personal fields", () => {
    const action = readFileSync("app/checkout/actions.ts", "utf8");
    expect(action).not.toMatch(/formString\(formData, "(email|name|country)"\)/);
    const form = readFileSync("components/checkout-form.tsx", "utf8");
    expect(form).not.toMatch(/name="(email|name|country)"/);
    expect(form).toContain('name="terms"');
    expect(form).toContain('name="immediateSupply"');
  });
});

describe("guest checkout (mock payment and supplier)", () => {
  let handle: DatabaseHandle;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.PAYMENT_WALLET = WALLET;
    process.env.PAYMENT_TOKEN_CONTRACT = CONTRACT;
    process.env.PAYMENT_CHAIN_ID = "56";
    process.env.BNB_RPC_URL = "https://rpc.example.invalid";
    handle = await makeTestDb();
  }, 180_000);

  afterAll(async () => {
    process.env = { ...originalEnv };
    await handle.close();
  });

  async function guestCart() {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst({ where: eq(plans.supplierKey, "mock") });
    await addCartItem(db, cart.cartId, plan!.id, 1);
    return cart;
  }

  it("creates a card order with no personal information and a long-lived private link", async () => {
    const cart = await guestCart();
    const before = Date.now();
    const result = await createCheckout(handle.db, { cartToken: cart.token, idempotencyKey: "guest-card-1" });

    const order = (await handle.db.select().from(orders).where(eq(orders.id, result.orderId)))[0]!;
    expect(order).toMatchObject({ email: "", customerName: "", country: "", userId: null, paymentStatus: "pending" });
    expect(result.paymentMethod).toBe("card");
    // Mock card payment page on our own site; nothing is charged.
    expect(result.redirectUrl).toMatch(/^\/checkout\/pay\/pay_/);
    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const token = (await handle.db.select().from(orderAccessTokens).where(eq(orderAccessTokens.orderId, order.id)))[0]!;
    expect(token.tokenHash).not.toBe(result.accessToken);
    expect(token.expiresAt.getTime() - before).toBeGreaterThan((GUEST_ORDER_ACCESS_DAYS - 1) * DAY_MS);
  });

  it("creates a USDT payment request for a guest without any transfer", async () => {
    const cart = await guestCart();
    const result = await createCheckout(handle.db, {
      cartToken: cart.token,
      idempotencyKey: "guest-crypto-1",
      paymentMethod: "crypto",
    });
    expect(result.paymentMethod).toBe("crypto");
    expect(result.redirectUrl).toContain(`/checkout/crypto/${result.cryptoPaymentId}`);
    const crypto = (await handle.db.select().from(cryptoPayments).where(eq(cryptoPayments.id, result.cryptoPaymentId!)))[0]!;
    expect(crypto.status).toBe("pending");
    expect(crypto.userId).toBeNull();
    const order = (await handle.db.select().from(orders).where(eq(orders.id, result.orderId)))[0]!;
    expect(order).toMatchObject({ email: "", paymentStatus: "pending" });
  });

  it("opens a guest order only with its own secret token", async () => {
    const cartA = await guestCart();
    const a = await createCheckout(handle.db, { cartToken: cartA.token, idempotencyKey: "guest-access-a" });
    const cartB = await guestCart();
    const b = await createCheckout(handle.db, { cartToken: cartB.token, idempotencyKey: "guest-access-b" });
    const orderA = (await handle.db.select().from(orders).where(eq(orders.id, a.orderId)))[0]!;

    expect(await canViewOrder(handle.db, orderA, { token: a.accessToken })).toBe(true);
    // Order number alone, a wrong token, or another order's token: refused.
    expect(await canViewOrder(handle.db, orderA, {})).toBe(false);
    expect(await canViewOrder(handle.db, orderA, { token: "x".repeat(43) })).toBe(false);
    expect(await canViewOrder(handle.db, orderA, { token: b.accessToken })).toBe(false);
    // A signed-in stranger cannot open a guest order either.
    expect(await canViewOrder(handle.db, orderA, { userId: "someone-else", role: "customer" })).toBe(false);
  });

  it("shows the real QR code only after a verified payment and mocked fulfillment, without email", async () => {
    const cart = await guestCart();
    const result = await createCheckout(handle.db, { cartToken: cart.token, idempotencyKey: "guest-deliver-1" });

    // Before payment: nothing to show.
    expect((await getOrderItems(handle.db, result.orderId))[0]!.esims).toHaveLength(0);

    await simulateMockPayment(handle.db, result.paymentId, "success");
    await runOutboxAndJobs(handle.db);
    await runOutboxAndJobs(handle.db);

    const order = (await handle.db.select().from(orders).where(eq(orders.id, result.orderId)))[0]!;
    expect(order.paymentStatus).toBe("paid");
    expect(order.fulfillmentStatus).toBe("delivered");
    const items = await getOrderItems(handle.db, result.orderId);
    expect(items[0]!.esims).toHaveLength(1);
    const esim = await handle.db.query.esims.findFirst({ where: (row, { eq: is }) => is(row.id, items[0]!.esims[0]!.id) });
    const activation = await buildActivation(esim!);
    expect(activation.lpa).toMatch(/^LPA:1\$/);
    expect(activation.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // No email address: no email was attempted or logged, delivery still worked.
    const mail = await handle.db.select().from(emailEvents).where(eq(emailEvents.orderId, result.orderId));
    expect(mail).toHaveLength(0);
  });

  it("saves signed-in orders to the account with the account's details", async () => {
    const user = { id: crypto.randomUUID(), email: "account.customer@example.com", name: "Account Customer" };
    await handle.db.insert(users).values({ ...user, passwordHash: "scrypt$unused", role: "customer" });
    const cart = await guestCart();
    const result = await createCheckout(handle.db, {
      cartToken: cart.token,
      idempotencyKey: "account-order-1",
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    const order = (await handle.db.select().from(orders).where(eq(orders.id, result.orderId)))[0]!;
    expect(order).toMatchObject({ userId: user.id, email: user.email.toLowerCase(), customerName: user.name });
    // Visible in the customer's own order history without a token.
    expect(await canViewOrder(handle.db, order, { userId: user.id, role: "customer" })).toBe(true);
  });
});

describe("guest order recovery helpers", () => {
  const token = "A".repeat(43);

  it("round-trips the device list and rejects tampered entries", () => {
    const list = addGuestOrder([], { orderNumber: "ES-261127-ABC123", token });
    const raw = serializeGuestOrders(list);
    expect(parseGuestOrders(raw)).toEqual(list);
    expect(parseGuestOrders("not-base64-json")).toEqual([]);
    const evil = Buffer.from(JSON.stringify([["<script>", token], ["ES-1", "short"]])).toString("base64url");
    expect(parseGuestOrders(evil)).toEqual([]);
  });

  it("keeps at most 20 orders, newest first, without duplicates", () => {
    let list = parseGuestOrders(undefined);
    for (let i = 0; i < 25; i += 1) {
      list = addGuestOrder(list, { orderNumber: `ES-261127-${String(i).padStart(6, "0")}`, token });
    }
    list = addGuestOrder(list, { orderNumber: "ES-261127-000024", token });
    expect(list).toHaveLength(20);
    expect(list[0]!.orderNumber).toBe("ES-261127-000024");
    expect(new Set(list.map((entry) => entry.orderNumber)).size).toBe(20);
  });

  it("reads a pasted order link or an order number with its access code", () => {
    expect(parseOrderAccessInput(`https://esimprove.com/fr/orders/ES-261127-ABC123?token=${token}`, "")).toEqual({
      orderNumber: "ES-261127-ABC123",
      token,
    });
    expect(parseOrderAccessInput(`https://esimprove.com/checkout/success?order=ES-261127-ABC123&token=${token}`, "")).toEqual({
      orderNumber: "ES-261127-ABC123",
      token,
    });
    expect(parseOrderAccessInput(token, "es-261127-abc123")).toEqual({ orderNumber: "ES-261127-ABC123", token });
    // The order number alone is never enough.
    expect(parseOrderAccessInput("", "ES-261127-ABC123")).toBeNull();
  });
});
