import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { z } from "zod";
import { currencyDecimals, parseMoneyToMinor } from "@/lib/money";
import {
  PaymentUnavailableError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentEvent,
} from "@/lib/integrations/payments/types";

/**
 * Whop adapter backed by the official `@whop/sdk`.
 *
 * Safety rules:
 * - The company API key and webhook secret are read only on the server.
 * - No credential is logged, returned, or attached to checkout metadata.
 * - Amounts and currencies are always derived from the server-side order, then
 *   compared with the Whop checkout response before a customer is redirected.
 * - Webhooks are verified with Whop's Standard Webhooks signature helper.
 */

export type WhopMode = "sandbox" | "live" | "unconfigured";

export type WhopPlanVariantMap = Record<string, string>;

export interface WhopRuntimeConfig {
  apiKey: string | null;
  webhookSecret: string | null;
  accountId: string | null;
  sandbox: boolean | null;
  appUrl: string;
  planVariants: WhopPlanVariantMap | null;
}

export class UnsupportedWhopEventError extends Error {
  constructor(eventType: string) {
    super(`Unsupported Whop webhook event type: ${eventType}`);
    this.name = "UnsupportedWhopEventError";
  }
}

function parseSandboxSetting(): boolean | null {
  const value = (process.env.WHOP_SANDBOX ?? "").trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function parsePlanVariantMap(raw: string | undefined): WhopPlanVariantMap | null {
  const value = raw?.trim();
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const map: WhopPlanVariantMap = {};
    for (const [key, variantId] of Object.entries(parsed)) {
      if (!key.trim() || typeof variantId !== "string") return null;
      const trimmed = variantId.trim();
      if (!trimmed.startsWith("plan_")) return null;
      map[key.trim()] = trimmed;
    }
    return map;
  } catch {
    return null;
  }
}

export function getWhopRuntimeConfig(): WhopRuntimeConfig {
  return {
    apiKey: process.env.WHOP_COMPANY_API_KEY?.trim() || null,
    webhookSecret: process.env.WHOP_WEBHOOK_SECRET?.trim() || null,
    accountId: process.env.WHOP_ACCOUNT_ID?.trim() || null,
    sandbox: parseSandboxSetting(),
    appUrl: (process.env.APP_URL?.trim() || process.env.SITE_URL?.trim() || "http://localhost:3000").replace(
      /\/+$/,
      "",
    ),
    planVariants: parsePlanVariantMap(process.env.WHOP_PLAN_VARIANT_MAP),
  };
}

export function isWhopCheckoutConfigured(): boolean {
  const config = getWhopRuntimeConfig();
  return Boolean(config.apiKey && config.sandbox !== null);
}

export function isWhopWebhookConfigured(): boolean {
  return Boolean(getWhopRuntimeConfig().webhookSecret);
}

export function whopMode(): WhopMode {
  const config = getWhopRuntimeConfig();
  if (!config.apiKey || config.sandbox === null) return "unconfigured";
  return config.sandbox ? "sandbox" : "live";
}

export function resolveWhopVariantId(planSlug: string, planId: string): string {
  const config = getWhopRuntimeConfig();
  if (config.planVariants === null) {
    throw new PaymentUnavailableError(
      "Whop plan mapping is invalid. WHOP_PLAN_VARIANT_MAP must be a JSON object mapping ESIMPROVE plan slugs or IDs to Whop variant IDs.",
    );
  }
  const variantId = config.planVariants[planSlug] ?? config.planVariants[planId];
  if (!variantId) {
    throw new PaymentUnavailableError(
      `Whop checkout is not configured for the selected plan. Add a WHOP_PLAN_VARIANT_MAP entry for plan "${planSlug}".`,
    );
  }
  return variantId;
}

let cachedClient: WhopClient | null = null;
let cachedClientToken: string | null = null;

function getWhopClient(apiKey: string, sandbox: boolean): WhopClient {
  if (!cachedClient || cachedClientToken !== apiKey) {
    cachedClient = new WhopClient({
      token: apiKey,
      environment: sandbox ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
      logging: { level: "error" },
      maxRetries: 1,
      timeoutInSeconds: 20,
    });
    cachedClientToken = apiKey;
  }
  return cachedClient;
}

/**
 * The Whop SDK returns a hosted checkout URL. Only HTTPS URLs on Whop's own
 * domain are accepted as redirect targets; this prevents a malformed provider
 * response from becoming an open redirect.
 */
export function isWhopCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "whop.com" || host.endsWith(".whop.com");
  } catch {
    return false;
  }
}

function variantMatchesPlan(
  variant: {
    id: string;
    initial_price: number;
    currency: string;
    billing_type: string;
  },
  expected: { variantId: string; amountMinor: number; currency: string },
): boolean {
  if (variant.id !== expected.variantId) return false;
  if (variant.billing_type !== "one_time") return false;
  if (variant.currency.toUpperCase() !== expected.currency.toUpperCase()) return false;
  const decimals = currencyDecimals(expected.currency);
  return Math.round(variant.initial_price * 10 ** decimals) === expected.amountMinor;
}

export async function createWhopCheckout(
  input: CreateCheckoutInput,
): Promise<CheckoutSession> {
  const config = getWhopRuntimeConfig();
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new PaymentUnavailableError(
      "Whop checkout is not configured. Set WHOP_COMPANY_API_KEY in the server environment.",
    );
  }
  if (config.sandbox === null) {
    throw new PaymentUnavailableError(
      "Whop checkout is not configured. Set WHOP_SANDBOX to true for sandbox or false for live mode.",
    );
  }
  if (!input.paymentId) {
    throw new PaymentUnavailableError(
      "Whop checkout is missing its ESIMPROVE payment reference. Please try again.",
    );
  }
  if (!input.items || input.items.length === 0) {
    throw new PaymentUnavailableError(
      "Whop checkout is missing the plan details. Please reload the checkout and try again.",
    );
  }
  if (input.items.length !== 1) {
    throw new PaymentUnavailableError(
      "Whop checkout currently supports one eSIM plan per order. Please check out each plan separately.",
    );
  }
  const item = input.items[0];
  if (item.quantity !== 1) {
    throw new PaymentUnavailableError(
      "Whop checkout currently supports a quantity of one per order. Update your cart before continuing.",
    );
  }
  if ((input.taxMinor ?? 0) !== 0) {
    throw new PaymentUnavailableError(
      "Whop checkout cannot be used while tax is included in the total. Please contact support.",
    );
  }
  if (input.amountMinor !== item.unitPriceMinor) {
    throw new PaymentUnavailableError(
      "The order total does not match the selected plan. Reload the checkout and try again.",
    );
  }

  const variantId = resolveWhopVariantId(item.planSlug, item.planId);
  const client = getWhopClient(apiKey, config.sandbox);

  let checkout: Awaited<
    ReturnType<WhopClient["checkoutConfigurations"]["create"]>
  >;
  try {
    checkout = await client.checkoutConfigurations.create(
      {
        ...(config.accountId ? { account_id: config.accountId } : {}),
        variant_id: variantId,
        redirect_url: input.returnUrl,
        metadata: {
          esimprove_order_id: input.orderId,
          esimprove_order_number: input.orderNumber,
          esimprove_payment_id: input.paymentId,
          esimprove_plan_id: item.planId,
          esimprove_plan_slug: item.planSlug,
        },
      },
      { idempotencyKey: `esimprove_checkout_${input.paymentId}` },
    );
  } catch {
    console.error("Whop checkout creation failed");
    throw new PaymentUnavailableError(
      "Whop checkout could not be created. No payment was taken. Please try again later.",
    );
  }

  if (
    !checkout.id?.startsWith("ch_") ||
    !checkout.purchase_url ||
    !isWhopCheckoutUrl(checkout.purchase_url)
  ) {
    throw new PaymentUnavailableError(
      "Whop did not return a valid checkout URL. No payment was taken.",
    );
  }

  const variant = checkout.variant;
  if (
    !variant ||
    !variantMatchesPlan(variant, {
      variantId,
      amountMinor: input.amountMinor,
      currency: input.currency,
    })
  ) {
    throw new PaymentUnavailableError(
      "The configured Whop variant does not match this plan's price or currency. Checkout was not opened and no payment was taken.",
    );
  }

  return {
    providerPaymentId: checkout.id,
    checkoutUrl: checkout.purchase_url,
  };
}

const whopWebhookSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.string().min(1).optional(),
  data: z.object({
    id: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    total: z
      .object({
        amount: z.string().min(1),
        currency: z.string().min(3).max(3),
        decimals: z.number().int().nonnegative().optional(),
      })
      .nullish(),
    currency: z.string().min(3).max(3).optional(),
    created_at: z.string().min(1).optional(),
  }),
});

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Verifies the raw body and the complete Standard Webhooks header set. The
 * caller must pass the exact bytes received from Whop; parsing first would
 * invalidate the signature.
 */
export function verifyWhopWebhook(
  rawBody: string,
  headers?: Record<string, string>,
): PaymentEvent {
  const config = getWhopRuntimeConfig();
  if (!config.webhookSecret) {
    throw new PaymentUnavailableError(
      "Whop webhook verification is not configured. Set WHOP_WEBHOOK_SECRET.",
    );
  }
  if (!headers) {
    throw new PaymentUnavailableError("Whop webhook headers are missing.");
  }

  const rawEvent = unwrapWebhook<unknown>(rawBody, {
    headers,
    key: config.webhookSecret,
  });
  const parsed = whopWebhookSchema.safeParse(rawEvent);
  if (!parsed.success) {
    throw new Error("Invalid Whop webhook payload");
  }

  const event = parsed.data;
  if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
    throw new UnsupportedWhopEventError(event.type);
  }

  const payment = event.data;
  if (!payment.id.startsWith("pay_")) {
    throw new Error("Whop webhook payment ID is invalid");
  }

  const metadata = payment.metadata ?? {};
  const orderId = metadataString(metadata, "esimprove_order_id");
  const internalPaymentId = metadataString(metadata, "esimprove_payment_id");
  if (!orderId?.startsWith("order_") || !internalPaymentId?.startsWith("pay_")) {
    throw new Error("Whop webhook is missing ESIMPROVE order references");
  }

  if (!payment.total) {
    throw new Error("Whop webhook payment total is missing");
  }
  if (!/^[A-Za-z]{3}$/.test(payment.total.currency)) {
    throw new Error("Whop webhook currency is invalid");
  }
  if (
    payment.currency &&
    payment.currency.toUpperCase() !== payment.total.currency.toUpperCase()
  ) {
    throw new Error("Whop webhook currency does not match the payment total");
  }

  return {
    eventId: event.id,
    type: event.type,
    paymentId: payment.id,
    internalPaymentId,
    orderId,
    amountMinor: parseMoneyToMinor(payment.total.amount, payment.total.currency),
    currency: payment.total.currency.toUpperCase(),
    createdAt: event.timestamp ?? payment.created_at ?? new Date().toISOString(),
  };
}

/**
 * Legacy guard retained for compatibility with existing imports. A webhook
 * signature cannot be verified from the signature header alone: the Standard
 * Webhooks scheme also needs `webhook-id`, `webhook-timestamp`, and the exact
 * raw body. The live route uses `verifyWhopWebhook`, which receives the full
 * header set. This helper therefore fails closed.
 *
 * @deprecated Use `verifyWhopWebhook(rawBody, headers)`.
 */
export function validateWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  void payload;
  void signatureHeader;
  void secret;
  return false;
}
