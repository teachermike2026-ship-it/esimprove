import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { currencyDecimals } from "@/lib/money";
import { flags, whopCredentials } from "@/lib/config";
import { parseWhopWebhook } from "@/lib/integrations/payment/whop-webhook";
import {
  PaymentUnavailableError,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentEvent,
  type RefundPaymentInput,
  type RefundPaymentResult,
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
  /**
   * Existing Whop product (`prod_...`). When set, a plan without an explicit
   * WHOP_PLAN_VARIANT_MAP entry is checked out with an inline one-time variant
   * of that product priced exactly at the server-side order total.
   */
  productId: string | null;
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

function parseProductId(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && /^prod_[A-Za-z0-9]+$/.test(value) ? value : null;
}

export function getWhopRuntimeConfig(): WhopRuntimeConfig {
  return {
    // Resolved in one place (lib/config.ts whopCredentials): separate
    // WHOP_SANDBOX_* variables in sandbox mode, standard variables for live.
    apiKey: whopCredentials().apiKey,
    webhookSecret: whopCredentials().webhookSecret,
    accountId: whopCredentials().companyId,
    sandbox: parseSandboxSetting(),
    appUrl: (process.env.APP_URL?.trim() || process.env.SITE_URL?.trim() || "http://localhost:3000").replace(
      /\/+$/,
      "",
    ),
    planVariants: parsePlanVariantMap(process.env.WHOP_PLAN_VARIANT_MAP),
    productId: parseProductId(whopCredentials().productId ?? undefined),
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

export type WhopCheckoutTarget =
  | { kind: "variant"; variantId: string }
  | { kind: "inline"; productId: string };

/**
 * Preferred: one existing Whop product (WHOP_PRODUCT_ID) and a dynamic
 * checkout per order whose inline one-time variant is priced exactly at the
 * server-side order total, so no plan needs its own static checkout link.
 * Fallback: an explicit per-plan WHOP_PLAN_VARIANT_MAP entry.
 */
export function resolveWhopCheckoutTarget(planSlug: string, planId: string): WhopCheckoutTarget {
  const config = getWhopRuntimeConfig();
  if (config.planVariants === null) {
    throw new PaymentUnavailableError(
      "Whop plan mapping is invalid. WHOP_PLAN_VARIANT_MAP must be a JSON object mapping ESIMPROVE plan slugs or IDs to Whop variant IDs.",
    );
  }
  if (config.productId) return { kind: "inline", productId: config.productId };
  const variantId = config.planVariants[planSlug] ?? config.planVariants[planId];
  if (variantId) return { kind: "variant", variantId };
  throw new PaymentUnavailableError(
    `Card checkout is not configured for this plan yet. Set WHOP_PRODUCT_ID or add a WHOP_PLAN_VARIANT_MAP entry for "${planSlug}".`,
  );
}

/** @deprecated Use resolveWhopCheckoutTarget. Kept for existing imports. */
export function resolveWhopVariantId(planSlug: string, planId: string): string {
  const target = resolveWhopCheckoutTarget(planSlug, planId);
  if (target.kind !== "variant") {
    throw new PaymentUnavailableError(
      `Whop checkout is not configured for the selected plan. Add a WHOP_PLAN_VARIANT_MAP entry for plan "${planSlug}".`,
    );
  }
  return target.variantId;
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
  expected: { variantId: string | null; amountMinor: number; currency: string },
): boolean {
  if (expected.variantId !== null && variant.id !== expected.variantId) return false;
  if (!variant.id?.startsWith("plan_")) return false;
  if (variant.billing_type !== "one_time") return false;
  if (variant.currency.toUpperCase() !== expected.currency.toUpperCase()) return false;
  const decimals = currencyDecimals(expected.currency);
  return Math.round(variant.initial_price * 10 ** decimals) === expected.amountMinor;
}

/**
 * Payment methods requested for every ESIMPROVE checkout: card explicitly
 * enabled, on top of Whop's platform defaults (wallets and local methods that
 * Whop shows automatically by buyer location stay available).
 */
export const WHOP_CHECKOUT_PAYMENT_METHODS = {
  // Card plus the wallets Whop supports. Whop shows Apple Pay / Google Pay only
  // where the device and browser support them (Apple Pay also needs the
  // checkout domain verified with Whop).
  enabled: ["card", "apple_pay", "google_pay"],
  // Whop's own crypto payment method is switched off: card payments go
  // through Whop, while USDT is ESIMPROVE's separate crypto checkout. (Whop
  // also rejects the configuration with 400 unless `disabled` is an array.)
  disabled: ["crypto"],
  include_platform_defaults: true,
} as const;

export type CardAvailability = "available" | "disabled" | "unconfirmed";

/**
 * Read Whop's `effective_payment_method_configuration` (resolved through the
 * checkout, variant, and account layers) and decide whether card can be
 * offered. `null`/missing means platform defaults, which Whop does not
 * document in detail, so that case is "unconfirmed", not "available".
 */
export function cardAvailability(
  effective:
    | { disabled?: readonly string[]; enabled?: readonly string[]; include_platform_defaults?: boolean }
    | null
    | undefined,
): CardAvailability {
  if (!effective) return "unconfirmed";
  if (effective.disabled?.includes("card")) return "disabled";
  if (effective.enabled?.includes("card")) return "available";
  if (effective.include_platform_defaults === false) return "disabled";
  return "unconfirmed";
}

export async function createWhopCheckout(
  input: CreateCheckoutInput,
): Promise<CheckoutSession> {
  const config = getWhopRuntimeConfig();
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new PaymentUnavailableError(
      "Whop checkout is not configured. Set WHOP_API_KEY in the server environment.",
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
  if ((input.taxMinor ?? 0) !== 0) {
    throw new PaymentUnavailableError(
      "Whop checkout cannot be used while tax is included in the total. Please contact support.",
    );
  }
  for (const line of input.items) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new PaymentUnavailableError("The order contains an invalid quantity. Reload the checkout and try again.");
    }
  }
  const itemsTotal = input.items.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor !== itemsTotal) {
    throw new PaymentUnavailableError(
      "The order total does not match the selected plan. Reload the checkout and try again.",
    );
  }
  const item = input.items[0]!;
  const singleLine = input.items.length === 1 && item.quantity === 1;

  const target = resolveWhopCheckoutTarget(item.planSlug, item.planId);
  // A pre-created per-plan variant has a fixed price, so it can only cover a
  // single plan at quantity one. The dynamic (product) path prices the whole
  // server-calculated order total.
  if (target.kind === "variant" && !singleLine) {
    throw new PaymentUnavailableError(
      "Card checkout for several plans needs WHOP_PRODUCT_ID. Please check out each plan separately.",
    );
  }
  const variantTitle = (
    singleLine ? item.planName : "ESIMPROVE eSIM order"
  ).slice(0, 80);
  const decimals = currencyDecimals(input.currency);
  // Whop prices are decimal amounts in the variant currency (5.00 = $5.00).
  // Derived from integer minor units; never from browser input.
  const initialPrice = Number((input.amountMinor / 10 ** decimals).toFixed(decimals));

  let checkout: Awaited<
    ReturnType<WhopClient["checkoutConfigurations"]["create"]>
  >;
  try {
    const client = getWhopClient(apiKey, config.sandbox);
    checkout = await client.checkoutConfigurations.create(
      {
        ...(config.accountId ? { account_id: config.accountId } : {}),
        ...(target.kind === "variant"
          ? { variant_id: target.variantId }
          : {
              variant: {
                product_id: target.productId,
                billing_type: "one_time",
                initial_price: initialPrice,
                currency: input.currency.toLowerCase(),
                title: variantTitle,
                visibility: "hidden",
                // Reuse an identical existing variant instead of creating one
                // per checkout.
                force_create_new_plan: false,
              },
            }),
        redirect_url: input.returnUrl,
        payment_method_configuration: {
          enabled: [...WHOP_CHECKOUT_PAYMENT_METHODS.enabled],
          disabled: [...WHOP_CHECKOUT_PAYMENT_METHODS.disabled],
          include_platform_defaults: WHOP_CHECKOUT_PAYMENT_METHODS.include_platform_defaults,
        },
        // Only order references: no customer data, no card data, and nothing
        // about other payment methods.
        metadata: {
          orderId: input.orderId,
          planId: item.planId,
          esimprove_order_id: input.orderId,
          esimprove_order_number: input.orderNumber,
          esimprove_payment_id: input.paymentId,
          esimprove_plan_id: item.planId,
          esimprove_plan_slug: item.planSlug,
        },
      },
      { idempotencyKey: `esimprove_checkout_${input.paymentId}` },
    );
  } catch (error) {
    // Log only the error class and HTTP status; never the key or raw body.
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? String((error as { statusCode?: unknown }).statusCode)
        : "n/a";
    console.error(
      `Whop checkout creation failed (${error instanceof Error ? error.name : "unknown"}, status ${status})`,
    );
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
      variantId: target.kind === "variant" ? target.variantId : null,
      amountMinor: input.amountMinor,
      currency: input.currency,
    })
  ) {
    throw new PaymentUnavailableError(
      "The configured Whop variant does not match this plan's price or currency. Checkout was not opened and no payment was taken.",
    );
  }

  // Card is the reason customers choose this method. If Whop resolved the
  // checkout with card switched off (product, variant, or account setting),
  // do not send the customer to a checkout without card.
  const card = cardAvailability(checkout.effective_payment_method_configuration);
  if (card === "disabled") {
    console.error("Whop checkout resolved without card payments (check product/account payment methods)");
    throw new PaymentUnavailableError(
      "Card payments are not available for this checkout right now. No payment was taken. Please choose another payment method or contact support.",
    );
  }
  if (card === "unconfirmed") {
    console.warn("Whop checkout created; card availability could not be confirmed from the response");
  }

  return {
    providerPaymentId: checkout.id,
    checkoutUrl: checkout.purchase_url,
  };
}

/**
 * Full refund of a Whop payment (`pay_...`) through the official SDK. The
 * idempotency key makes a repeated admin click a no-op at Whop. ESIMPROVE does
 * not mark anything refunded here: the verified `refund.*` webhook does.
 */
export async function refundWhopPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
  const config = getWhopRuntimeConfig();
  if (!config.apiKey || config.sandbox === null) {
    throw new PaymentUnavailableError("Whop is not configured, so the refund could not be requested.");
  }
  // Same gate as live checkout: a live refund needs PAYMENTS_LIVE_ENABLED=true.
  if (!config.sandbox && !flags.paymentsLive) {
    throw new PaymentUnavailableError(
      "Live Whop refunds are disabled in this deployment (PAYMENTS_LIVE_ENABLED is not true). Nothing was changed.",
    );
  }
  if (!/^pay_[A-Za-z0-9]+$/.test(input.providerPaymentId)) {
    throw new PaymentUnavailableError(
      "This order has no confirmed Whop payment to refund yet. Wait for the payment webhook, then try again.",
    );
  }
  try {
    const payment = await getWhopClient(config.apiKey, config.sandbox).payments.refund(
      { id: input.providerPaymentId, metadata: input.metadata },
      { idempotencyKey: input.idempotencyKey },
    );
    const status = (payment as { substatus?: unknown; status?: unknown }).substatus ?? payment.status;
    return { providerStatus: typeof status === "string" ? status : "requested" };
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? String((error as { statusCode?: unknown }).statusCode)
        : "n/a";
    console.error(`Whop refund request failed (${error instanceof Error ? error.name : "unknown"}, status ${status})`);
    throw new PaymentUnavailableError(
      "Whop did not accept the refund request. Nothing was changed; check the payment in the Whop dashboard.",
    );
  }
}

/**
 * Verifies the raw body and the complete Standard Webhooks header set, then
 * parses a payment event. The caller must pass the exact bytes received from
 * Whop; parsing first would invalidate the signature. Refund, dispute, and
 * non-ESIMPROVE events are handled by `handleWhopWebhook`; through this
 * payment-only entry point they raise `UnsupportedWhopEventError`.
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
  const parsed = parseWhopWebhook(rawBody, headers, config.webhookSecret);
  if (parsed.kind !== "payment") throw new UnsupportedWhopEventError(parsed.type);
  return parsed.event;
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
