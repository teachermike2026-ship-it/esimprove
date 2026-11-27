import { unwrapWebhook } from "@whop/sdk/helpers";
import { z } from "zod";
import { currencyDecimals } from "@/lib/money";
import type { PaymentEvent } from "@/lib/integrations/payments/types";

/**
 * Whop webhook parsing (Standard Webhooks, `v1` payloads).
 *
 * Shapes follow the public OpenAPI document
 * (https://api.whop.com/api/v1/openapi.json, `x-api-version-date` 2026-11-23-3):
 *   payment.succeeded / payment.failed -> data: #/components/schemas/Payment
 *   refund.created / refund.updated    -> data: #/components/schemas/RefundLegacy
 *   dispute.created / dispute.updated  -> data: #/components/schemas/Dispute
 *
 * The webhook endpoint must be pinned to WHOP_WEBHOOK_API_VERSION_DATE (see
 * docs/WHOP-WEBHOOKS.md). Payloads are validated strictly; an unpinned or
 * differently shaped payload is rejected rather than guessed at.
 */

export const WHOP_WEBHOOK_API_VERSION = "v1";
/** Dated API version these schemas were verified against. */
export const WHOP_WEBHOOK_API_VERSION_DATE = "2026-11-23-3";

/** Event types this integration acts on. Everything else is acknowledged and ignored. */
export const WHOP_HANDLED_EVENT_TYPES = [
  "payment.succeeded",
  "payment.failed",
  "payment.pending",
  "payment.requires_action",
  "payment.canceled",
  "refund.created",
  "refund.updated",
  "dispute.created",
  "dispute.updated",
] as const;

export class WhopWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopWebhookPayloadError";
  }
}

/**
 * Whop currency codes are lowercase (`Currencies` enum): ISO codes such as
 * `usd`, plus non-ISO values such as `usdt` and `whop_usd`.
 */
const currencyCode = z.string().regex(/^[a-z][a-z_]{2,15}$/);
/** Dispute.currency is documented only as a three-letter code; accept either case. */
const looseCurrencyCode = z.string().regex(/^[A-Za-z][A-Za-z_]{2,15}$/);

const money = z.object({
  amount: z.string().regex(/^\d{1,15}(\.\d{1,18})?$/),
  currency: currencyCode,
  decimals: z.number().int().min(0).max(18),
});

const metadataSchema = z.record(z.string(), z.unknown()).nullable();

const paymentData = z.object({
  id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  status: z.string().nullable(),
  currency: currencyCode,
  total: money.nullable(),
  subtotal: money.nullable().optional(),
  tax_amount: money.nullable().optional(),
  tax_behavior: z.string().nullable().optional(),
  metadata: metadataSchema,
  checkout_configuration_id: z.string().nullable().optional(),
  product_id: z.string().nullable().optional(),
  variant_id: z.string().nullable().optional(),
  customer_email: z.string().nullable().optional(),
});

const refundData = z.object({
  id: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: currencyCode,
  status: z.string().min(1),
  payment: z
    .object({
      id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
      metadata: metadataSchema.optional(),
    })
    .nullable(),
});

const disputeData = z.object({
  id: z.string().regex(/^dspt_[A-Za-z0-9]+$/),
  amount: z.number().nonnegative(),
  currency: looseCurrencyCode,
  status: z.string().min(1),
  reason: z.string().nullable().optional(),
  payment: z.object({ id: z.string().regex(/^pay_[A-Za-z0-9]+$/) }).nullable(),
});

const envelope = z.object({
  id: z.string().min(1),
  api_version: z.literal(WHOP_WEBHOOK_API_VERSION),
  api_version_date: z.string().nullable(),
  timestamp: z.string().min(1),
  type: z.string().min(1),
  data: z.unknown(),
});

export interface WhopWebhookMeta {
  /** Signed `webhook-id` header: identical on every retry of a delivery. */
  webhookId: string;
  type: string;
  apiVersionDate: string | null;
}

export interface WhopCaseEvent {
  kind: "refund" | "dispute";
  providerCaseId: string;
  providerPaymentId: string | null;
  /** ESIMPROVE references carried in the refunded payment's metadata, if any. */
  orderId: string | null;
  internalPaymentId: string | null;
  /** Decimal amount in major units as sent by Whop (a JSON number). */
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
}

export type WhopWebhookEvent =
  | (WhopWebhookMeta & { kind: "payment"; event: PaymentEvent })
  | (WhopWebhookMeta & { kind: "case"; caseEvent: WhopCaseEvent })
  | (WhopWebhookMeta & { kind: "ignored"; reason: string });

/**
 * Convert an exact decimal string to integer minor units of `currency`.
 * Returns null when the value cannot be represented exactly (never rounds).
 */
export function decimalStringToMinor(amount: string, currency: string): number | null {
  const match = /^(\d{1,15})(?:\.(\d{1,18}))?$/.exec(amount.trim());
  if (!match) return null;
  const decimals = currencyDecimals(currency);
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > decimals) return null;
  const minor =
    BigInt(match[1]!) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

/** Convert a JSON-number amount (RefundLegacy/Dispute) to minor units, exactly or not at all. */
export function decimalNumberToMinor(amount: number, currency: string): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const decimals = currencyDecimals(currency);
  const scaled = amount * 10 ** decimals;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6 || !Number.isSafeInteger(rounded)) return null;
  return rounded;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Compute the amount ESIMPROVE expects to match the order price.
 *
 * `total` is the price after discounts plus any tax added on top; it excludes
 * buyer fees (which the buyer pays above it and are not ESIMPROVE revenue).
 * So: expected price = total - exclusive tax. A discount makes this smaller
 * than the order price and is flagged, never silently accepted.
 */
function paymentAmounts(payment: z.infer<typeof paymentData>): {
  currency: string;
  netMinor: number;
  subtotalMinor?: number;
  reviewReason?: string;
} {
  const currency = payment.currency.toUpperCase();
  if (!payment.total) {
    return { currency, netMinor: -1, reviewReason: "Whop payment total is missing" };
  }
  if (payment.total.currency !== payment.currency) {
    return {
      currency,
      netMinor: -1,
      reviewReason: "Whop payment total currency differs from the settlement currency",
    };
  }
  const totalMinor = decimalStringToMinor(payment.total.amount, currency);
  if (totalMinor === null) {
    return { currency, netMinor: -1, reviewReason: "Whop payment total is not an exact amount" };
  }
  let taxMinor = 0;
  if (payment.tax_amount && payment.tax_behavior === "exclusive") {
    if (payment.tax_amount.currency !== payment.currency) {
      return { currency, netMinor: -1, reviewReason: "Whop tax currency differs from settlement currency" };
    }
    const parsed = decimalStringToMinor(payment.tax_amount.amount, currency);
    if (parsed === null) {
      return { currency, netMinor: -1, reviewReason: "Whop tax amount is not an exact amount" };
    }
    taxMinor = parsed;
  }
  let subtotalMinor: number | undefined;
  if (payment.subtotal) {
    const parsed =
      payment.subtotal.currency === payment.currency
        ? decimalStringToMinor(payment.subtotal.amount, currency)
        : null;
    if (parsed === null) {
      return { currency, netMinor: -1, reviewReason: "Whop payment subtotal is not comparable" };
    }
    subtotalMinor = parsed;
  }
  return { currency, netMinor: totalMinor - taxMinor, subtotalMinor };
}

/**
 * Whop payment events mapped to the provider-agnostic event types.
 * `payment.pending` and `payment.requires_action` (for example 3-D Secure)
 * are recorded but never change payment status; `payment.canceled` is
 * treated like a failed attempt.
 */
function paymentEventType(type: string): PaymentEvent["type"] {
  if (type === "payment.succeeded") return "payment.succeeded";
  if (type === "payment.pending" || type === "payment.requires_action") return "payment.pending";
  return "payment.failed";
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new WhopWebhookPayloadError(`Invalid Whop ${label} payload`);
  }
  return parsed.data;
}

/**
 * Verify the Standard Webhooks signature, then parse the event.
 *
 * Throws `WebhookVerificationError` (from @whop/sdk/helpers) for a bad
 * signature and `WhopWebhookPayloadError` for a malformed payload.
 */
export function parseWhopWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): WhopWebhookEvent {
  const raw = unwrapWebhook<unknown>(rawBody, { headers, key: secret });
  // The signature covers `webhook-id`, so the header is authenticated.
  const webhookId = (headers["webhook-id"] ?? "").trim();
  if (!webhookId) throw new WhopWebhookPayloadError("Whop webhook-id header is missing");

  const env = parseOrThrow(envelope, raw, "envelope");
  const meta: WhopWebhookMeta = {
    webhookId,
    type: env.type,
    apiVersionDate: env.api_version_date,
  };

  if (!(WHOP_HANDLED_EVENT_TYPES as readonly string[]).includes(env.type)) {
    return { ...meta, kind: "ignored", reason: "event type not handled" };
  }

  if (env.type.startsWith("payment.")) {
    const payment = parseOrThrow(paymentData, env.data, "payment");
    // `orderId` / `planId` are the documented checkout metadata keys; the
    // `esimprove_*` keys are kept for checkouts created before they existed.
    const orderId =
      metadataString(payment.metadata, "orderId") ?? metadataString(payment.metadata, "esimprove_order_id");
    const internalPaymentId = metadataString(payment.metadata, "esimprove_payment_id");
    if (!orderId && !internalPaymentId) {
      // Other sales on the same Whop account: acknowledge, never process.
      return { ...meta, kind: "ignored", reason: "payment has no ESIMPROVE references" };
    }
    if (!orderId?.startsWith("order_") || !internalPaymentId?.startsWith("pay_")) {
      throw new WhopWebhookPayloadError("Whop payment has malformed ESIMPROVE references");
    }
    const amounts = paymentAmounts(payment);
    return {
      ...meta,
      kind: "payment",
      event: {
        eventId: webhookId,
        type: paymentEventType(env.type),
        paymentId: payment.id,
        internalPaymentId,
        orderId,
        amountMinor: amounts.netMinor,
        currency: amounts.currency,
        createdAt: env.timestamp,
        providerStatus: payment.status ?? "",
        subtotalMinor: amounts.subtotalMinor,
        reviewReason: amounts.reviewReason,
        checkoutConfigurationId: payment.checkout_configuration_id ?? null,
        productId: payment.product_id ?? null,
        customerEmail: payment.customer_email ?? null,
      },
    };
  }

  if (env.type === "refund.created" || env.type === "refund.updated") {
    const refund = parseOrThrow(refundData, env.data, "refund");
    return {
      ...meta,
      kind: "case",
      caseEvent: {
        kind: "refund",
        providerCaseId: refund.id,
        providerPaymentId: refund.payment?.id ?? null,
        orderId:
          metadataString(refund.payment?.metadata, "orderId") ??
          metadataString(refund.payment?.metadata, "esimprove_order_id"),
        internalPaymentId: metadataString(refund.payment?.metadata, "esimprove_payment_id"),
        amount: refund.amount,
        currency: refund.currency.toUpperCase(),
        status: refund.status,
        reason: null,
      },
    };
  }

  const dispute = parseOrThrow(disputeData, env.data, "dispute");
  return {
    ...meta,
    kind: "case",
    caseEvent: {
      kind: "dispute",
      providerCaseId: dispute.id,
      providerPaymentId: dispute.payment?.id ?? null,
      orderId: null,
      internalPaymentId: null,
      amount: dispute.amount,
      currency: dispute.currency.toUpperCase(),
      status: dispute.status,
      reason: dispute.reason ?? null,
    },
  };
}
