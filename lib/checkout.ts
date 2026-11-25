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
import { isWhopCheckoutUrl } from "@/lib/integrations/payment/whop";
import {
  PaymentUnavailableError,
  type CheckoutItem,
} from "@/lib/integrations/payments/types";
import { generateOrderNumber, newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { appUrl, onlineCheckoutAvailable, siteUrl } from "@/lib/config";
import {
  createCryptoPayment,
  cryptoPaymentUrl,
  getCryptoPaymentByOrderId,
} from "@/lib/payments/crypto/payment-service";
import { loadCryptoPaymentConfig } from "@/lib/payments/crypto/config";
import {
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  type CheckoutPaymentMethod,
} from "@/lib/checkout-payment";

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
  /** Card is the default; crypto requires a complete server configuration. */
  paymentMethod?: CheckoutPaymentMethod;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  checkoutUrl: string;
  redirectUrl: string;
  accessToken: string;
  totalMinor: number;
  currency: string;
  provider: string;
  isMock: boolean;
  paymentMethod: CheckoutPaymentMethod;
  cryptoPaymentId?: string;
}

async function paymentForOrder(db: Database, orderId: string) {
  return getPaymentForOrder(db, orderId);
}

function localPaymentUrl(paymentId: string, accessToken: string): string {
  return `/checkout/pay/${encodeURIComponent(paymentId)}?token=${encodeURIComponent(accessToken)}`;
}

function successUrl(orderNumber: string, accessToken: string): string {
  const query = new URLSearchParams({ order: orderNumber, token: accessToken });
  return `${appUrl}/checkout/success?${query.toString()}`;
}

function redirectUrlForPayment(input: {
  paymentId: string;
  paymentStatus: string;
  provider: string;
  isMock: boolean;
  checkoutUrl: string;
  orderNumber: string;
  accessToken: string;
}): string {
  if (input.paymentStatus === "paid") {
    return successUrl(input.orderNumber, input.accessToken);
  }
  if (input.isMock || input.provider === "mock" || input.paymentStatus === "failed") {
    return localPaymentUrl(input.paymentId, input.accessToken);
  }
  if (input.provider === "whop") {
    if (!isWhopCheckoutUrl(input.checkoutUrl)) {
      throw new CheckoutError(
        "unavailable",
        "The payment checkout link is invalid. No payment was taken. Please contact support.",
      );
    }
    return input.checkoutUrl;
  }
  // Unknown non-mock providers must not be redirected to an unvalidated URL.
  throw new CheckoutError(
    "unavailable",
    "The payment provider is not configured for checkout. No payment was taken.",
  );
}

async function loadOrderItems(
  db: Database,
  orderId: string,
): Promise<CheckoutItem[]> {
  const rows = await db
    .select({
      planId: orderItems.planId,
      planName: orderItems.planName,
      quantity: orderItems.quantity,
      unitPriceMinor: orderItems.unitPriceMinor,
      planSlug: plans.slug,
    })
    .from(orderItems)
    .innerJoin(plans, eq(orderItems.planId, plans.id))
    .where(eq(orderItems.orderId, orderId));
  return rows.map((row) => ({
    planId: row.planId,
    planSlug: row.planSlug,
    planName: row.planName,
    quantity: row.quantity,
    unitPriceMinor: row.unitPriceMinor,
  }));
}

async function createPaymentForOrder(
  db: Database,
  input: {
    orderId: string;
    orderNumber: string;
    amountMinor: number;
    currency: string;
    email: string;
    items: CheckoutItem[];
    taxMinor: number;
    returnUrl: string;
  },
) {
  const provider = getPaymentProvider();
  const paymentId = newId("pay");
  let checkout: Awaited<ReturnType<typeof provider.createCheckout>>;
  try {
    checkout = await provider.createCheckout({
      paymentId,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      amountMinor: input.amountMinor,
      currency: input.currency,
      customerEmail: input.email,
      returnUrl: input.returnUrl,
      items: input.items,
      taxMinor: input.taxMinor,
    });
  } catch (error) {
    if (error instanceof PaymentUnavailableError) {
      throw new CheckoutError("unavailable", error.message);
    }
    throw error;
  }
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
  return {
    paymentId,
    checkoutUrl,
    provider: provider.key,
    isMock: provider.isMock,
  };
}

export async function createCheckout(
  db: Database,
  input: CreateCheckoutInput,
): Promise<CheckoutResult> {
  const paymentMethod = input.paymentMethod ?? DEFAULT_CHECKOUT_PAYMENT_METHOD;
  const cryptoConfig =
    paymentMethod === "crypto" ? loadCryptoPaymentConfig() : null;

  // Card needs the configured card provider (Whop). Crypto is independent: it
  // only needs a complete crypto configuration, so crypto can be accepted
  // while card payments are still being connected.
  if (paymentMethod !== "crypto" && !onlineCheckoutAvailable()) {
    throw new CheckoutError(
      "unavailable",
      "Online checkout is not available in this deployment. No payment provider is configured and enabled.",
    );
  }
  if (paymentMethod === "crypto" && !cryptoConfig) {
    throw new CheckoutError(
      "unavailable",
      "Crypto payments are not configured in this deployment. Choose card payment or contact support.",
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
      throw new CheckoutError(
        "unavailable",
        "One of the plans in your cart is no longer available.",
      );
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
      "A plan price changed while you were checking out. Review the new total before continuing.",
    );
  }

  const currency = priced[0]?.plan.currency ?? "USD";
  if (priced.some((line) => line.plan.currency !== currency)) {
    throw new CheckoutError(
      "unavailable",
      "Plans with different currencies cannot be combined in one order.",
    );
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
    const accessToken = await createOrderAccessToken(db, existing.id);
    const existingCrypto = await getCryptoPaymentByOrderId(db, existing.id);
    if (existingCrypto) {
      const cryptoUrl = cryptoPaymentUrl(existingCrypto.id, accessToken);
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        paymentId: existingCrypto.paymentId,
        checkoutUrl: cryptoUrl,
        redirectUrl: cryptoUrl,
        accessToken,
        totalMinor: existing.totalMinor,
        currency: existing.currency,
        provider: "crypto",
        isMock: false,
        paymentMethod: "crypto",
        cryptoPaymentId: existingCrypto.id,
      };
    }

    const existingPayment = await paymentForOrder(db, existing.id);
    if (existingPayment) {
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        paymentId: existingPayment.id,
        checkoutUrl: existingPayment.checkoutUrl,
        redirectUrl: redirectUrlForPayment({
          paymentId: existingPayment.id,
          paymentStatus: existingPayment.status,
          provider: existingPayment.provider,
          isMock: existingPayment.provider === "mock",
          checkoutUrl: existingPayment.checkoutUrl,
          orderNumber: existing.orderNumber,
          accessToken,
        }),
        accessToken,
        totalMinor: existing.totalMinor,
        currency: existing.currency,
        provider: existingPayment.provider,
        isMock: existingPayment.provider === "mock",
        paymentMethod: "card",
      };
    }

    if (paymentMethod === "crypto") {
      const createdCrypto = await createCryptoPayment(db, {
        orderId: existing.id,
        amountMinor: existing.totalMinor,
        currency: existing.currency,
        userId: existing.userId,
      });
      const cryptoUrl = cryptoPaymentUrl(createdCrypto.cryptoPaymentId, accessToken);
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        paymentId: createdCrypto.paymentId,
        checkoutUrl: cryptoUrl,
        redirectUrl: cryptoUrl,
        accessToken,
        totalMinor: existing.totalMinor,
        currency: existing.currency,
        provider: "crypto",
        isMock: false,
        paymentMethod: "crypto",
        cryptoPaymentId: createdCrypto.cryptoPaymentId,
      };
    }

    const createdPayment = await createPaymentForOrder(db, {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      amountMinor: existing.totalMinor,
      currency: existing.currency,
      email: existing.email,
      items: await loadOrderItems(db, existing.id),
      taxMinor: existing.taxMinor,
      returnUrl: successUrl(existing.orderNumber, accessToken),
    });
    return {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      paymentId: createdPayment.paymentId,
      checkoutUrl: createdPayment.checkoutUrl,
      redirectUrl: redirectUrlForPayment({
        paymentId: createdPayment.paymentId,
        paymentStatus: "pending",
        provider: createdPayment.provider,
        isMock: createdPayment.isMock,
        checkoutUrl: createdPayment.checkoutUrl,
        orderNumber: existing.orderNumber,
        accessToken,
      }),
      accessToken,
      totalMinor: existing.totalMinor,
      currency: existing.currency,
      provider: createdPayment.provider,
      isMock: createdPayment.isMock,
      paymentMethod: "card",
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
      termsVersion: input.termsVersion ?? "terms-1.0",
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
      message:
        paymentMethod === "crypto"
          ? "Order created; crypto payment is pending."
          : "Order created; payment is pending.",
      metadata: {
        totalMinor: totals.totalMinor,
        currency,
        idempotencyKey: input.idempotencyKey,
        paymentMethod,
      },
    });
  });

  const accessToken = await createOrderAccessToken(db, orderId);

  if (paymentMethod === "crypto") {
    const cryptoPayment = await createCryptoPayment(db, {
      orderId,
      amountMinor: totals.totalMinor,
      currency,
      userId: input.userId ?? null,
    });
    const cryptoUrl = cryptoPaymentUrl(cryptoPayment.cryptoPaymentId, accessToken);
    await recordAudit(db, {
      actorType: input.userId ? "user" : "guest",
      actorId: input.userId ?? null,
      action: "order.created",
      entityType: "order",
      entityId: orderId,
      metadata: {
        orderNumber,
        totalMinor: totals.totalMinor,
        currency,
        isDemo: true,
        paymentMethod: "crypto",
        cryptoPaymentId: cryptoPayment.cryptoPaymentId,
      },
    });
    return {
      orderId,
      orderNumber,
      paymentId: cryptoPayment.paymentId,
      checkoutUrl: cryptoUrl,
      redirectUrl: cryptoUrl,
      accessToken,
      totalMinor: totals.totalMinor,
      currency,
      provider: "crypto",
      isMock: false,
      paymentMethod: "crypto",
      cryptoPaymentId: cryptoPayment.cryptoPaymentId,
    };
  }

  const payment = await createPaymentForOrder(db, {
    orderId,
    orderNumber,
    amountMinor: totals.totalMinor,
    currency,
    email: input.email,
    items: priced.map((line) => ({
      planId: line.plan.id,
      planSlug: line.plan.slug,
      planName: line.plan.name,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
    })),
    taxMinor: totals.taxMinor,
    returnUrl: successUrl(orderNumber, accessToken),
  });

  await recordAudit(db, {
    actorType: input.userId ? "user" : "guest",
    actorId: input.userId ?? null,
    action: "order.created",
    entityType: "order",
    entityId: orderId,
    metadata: {
      orderNumber,
      totalMinor: totals.totalMinor,
      currency,
      isDemo: true,
      paymentMethod: "card",
    },
  });

  return {
    orderId,
    orderNumber,
    paymentId: payment.paymentId,
    checkoutUrl: payment.checkoutUrl,
    redirectUrl: redirectUrlForPayment({
      paymentId: payment.paymentId,
      paymentStatus: "pending",
      provider: payment.provider,
      isMock: payment.isMock,
      checkoutUrl: payment.checkoutUrl,
      orderNumber,
      accessToken,
    }),
    accessToken,
    totalMinor: totals.totalMinor,
    currency,
    provider: payment.provider,
    isMock: payment.isMock,
    paymentMethod: "card",
  };
}
