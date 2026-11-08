import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  cartItems,
  orderEvents,
  orderItems,
  orders,
  payments,
  plans,
} from "@/lib/db/schema";
import { getCartView } from "@/lib/cart";
import { calculateTotals } from "@/lib/pricing";
import { createOrderAccessToken } from "@/lib/orders";
import { getPaymentForOrder } from "@/lib/payments";
import { getPaymentProvider } from "@/lib/integrations/payments";
import { generateOrderNumber, newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { mockCommerceAllowed, siteUrl } from "@/lib/config";

export type CheckoutErrorCode = "empty_cart" | "price_changed" | "unavailable";

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode;

  constructor(code: CheckoutErrorCode, message: string) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
  }
}

export interface CreateCheckoutInput {
  cartToken: string;
  email: string;
  name: string;
  country: string;
  idempotencyKey: string;
  userId?: string | null;
  termsVersion?: string;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  checkoutUrl: string;
  accessToken: string;
  totalMinor: number;
  currency: string;
}

async function paymentForOrder(db: Database, orderId: string) {
  return getPaymentForOrder(db, orderId);
}

async function createPaymentForOrder(
  db: Database,
  input: {
    orderId: string;
    orderNumber: string;
    amountMinor: number;
    currency: string;
    email: string;
  },
) {
  const provider = getPaymentProvider();
  const checkout = await provider.createCheckout({
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    amountMinor: input.amountMinor,
    currency: input.currency,
    customerEmail: input.email,
    returnUrl: `${siteUrl}/checkout/success`,
  });
  const paymentId = newId("pay");
  const checkoutUrl = provider.isMock
    ? `${siteUrl}/checkout/pay/${paymentId}`
    : checkout.checkoutUrl;
  await db.insert(payments).values({
    id: paymentId,
    orderId: input.orderId,
    provider: provider.key,
    providerPaymentId: checkout.providerPaymentId,
    status: "pending",
    amountMinor: input.amountMinor,
    currency: input.currency,
    checkoutUrl,
  });
  return { paymentId, checkoutUrl };
}

export async function createCheckout(
  db: Database,
  input: CreateCheckoutInput,
): Promise<CheckoutResult> {
  if (!mockCommerceAllowed) {
    throw new CheckoutError(
      "unavailable",
      "Online checkout is not available in this deployment. No live payment provider is configured.",
    );
  }

  const cart = await getCartView(db, input.cartToken);
  if (!cart || cart.lines.length === 0) {
    throw new CheckoutError("empty_cart", "Your cart is empty.");
  }

  const planRows = await db
    .select()
    .from(plans)
    .where(inArray(plans.id, cart.lines.map((line) => line.planId)));
  const planById = new Map(planRows.map((plan) => [plan.id, plan]));

  let priceChanged = false;
  const priced = cart.lines.map((line) => {
    const plan = planById.get(line.planId);
    if (!plan || plan.status !== "published") {
      throw new CheckoutError("unavailable", "One of the demo plans is no longer available.");
    }
    if (plan.priceMinor !== line.unitPriceMinor) priceChanged = true;
    return {
      plan,
      quantity: line.quantity,
      unitPriceMinor: plan.priceMinor,
    };
  });

  if (priceChanged) {
    for (const line of cart.lines) {
      const plan = planById.get(line.planId);
      if (plan && plan.priceMinor !== line.unitPriceMinor) {
        await db
          .update(cartItems)
          .set({ unitPriceMinor: plan.priceMinor, currency: plan.currency })
          .where(and(eq(cartItems.cartId, cart.cartId), eq(cartItems.planId, line.planId)));
      }
    }
    throw new CheckoutError(
      "price_changed",
      "A demo plan price changed while you were checking out. Review the new total before paying.",
    );
  }

  const currency = priced[0]?.plan.currency ?? "USD";
  if (priced.some((line) => line.plan.currency !== currency)) {
    throw new CheckoutError("unavailable", "Mixed currencies are not supported in this demo.");
  }
  const totals = calculateTotals(
    priced.map((line) => ({ unitPriceMinor: line.unitPriceMinor, quantity: line.quantity })),
    priced[0]?.plan.taxBps ?? 0,
  );

  const existingRows = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, input.idempotencyKey))
    .limit(1);
  const existing = existingRows[0];
  if (existing) {
    const existingPayment = await paymentForOrder(db, existing.id);
    let paymentId: string;
    let checkoutUrl: string;
    if (existingPayment) {
      paymentId = existingPayment.id;
      checkoutUrl = existingPayment.checkoutUrl;
    } else {
      const createdPayment = await createPaymentForOrder(db, {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        amountMinor: existing.totalMinor,
        currency: existing.currency,
        email: existing.email,
      });
      paymentId = createdPayment.paymentId;
      checkoutUrl = createdPayment.checkoutUrl;
    }
    const accessToken = await createOrderAccessToken(db, existing.id);
    return {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      paymentId,
      checkoutUrl,
      accessToken,
      totalMinor: existing.totalMinor,
      currency: existing.currency,
    };
  }

  const orderId = newId("order");
  const orderNumber = generateOrderNumber();

  await db.transaction(async (tx) => {
    await tx.insert(orders).values({
      id: orderId,
      orderNumber,
      email: input.email,
      customerName: input.name,
      country: input.country,
      userId: input.userId ?? null,
      status: "pending_payment",
      paymentStatus: "pending",
      fulfillmentStatus: "not_started",
      subtotalMinor: totals.subtotalMinor,
      taxMinor: totals.taxMinor,
      totalMinor: totals.totalMinor,
      currency,
      idempotencyKey: input.idempotencyKey,
      termsVersion: input.termsVersion ?? "demo-terms-v1",
      isDemo: true,
    });

    await tx.insert(orderItems).values(
      priced.map((line) => ({
        id: newId("orderitem"),
        orderId,
        planId: line.plan.id,
        planName: line.plan.name,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        totalMinor: line.unitPriceMinor * line.quantity,
        costMinor: line.plan.costMinor * line.quantity,
        supplierKey: line.plan.supplierKey,
        supplierProductId: line.plan.supplierProductId,
        dataMb: line.plan.dataMb,
        validityDays: line.plan.validityDays,
        currency,
      })),
    );

    await tx.insert(orderEvents).values({
      id: newId("orderevent"),
      orderId,
      type: "order.created",
      message: "Demo order created; payment is pending.",
      metadata: { totalMinor: totals.totalMinor, currency, idempotencyKey: input.idempotencyKey },
    });
  });

  const accessToken = await createOrderAccessToken(db, orderId);
  const payment = await createPaymentForOrder(db, {
    orderId,
    orderNumber,
    amountMinor: totals.totalMinor,
    currency,
    email: input.email,
  });

  await recordAudit(db, {
    actorType: input.userId ? "user" : "guest",
    actorId: input.userId ?? null,
    action: "order.created",
    entityType: "order",
    entityId: orderId,
    metadata: { orderNumber, totalMinor: totals.totalMinor, currency, isDemo: true },
  });

  return {
    orderId,
    orderNumber,
    paymentId: payment.paymentId,
    checkoutUrl: payment.checkoutUrl,
    accessToken,
    totalMinor: totals.totalMinor,
    currency,
  };
}
