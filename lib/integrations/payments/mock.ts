import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mockWebhookSecret, siteUrl } from "@/lib/config";
import { hmacHex, safeEqual } from "@/lib/crypto";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentEvent,
  PaymentProvider,
} from "@/lib/integrations/payments/types";

const eventSchema = z.object({
  eventId: z.string().min(1),
  type: z.enum(["payment.succeeded", "payment.failed"]),
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: z.string().min(1),
});

export function signMockWebhook(rawBody: string): string {
  return hmacHex(rawBody, mockWebhookSecret());
}

export class MockPaymentProvider implements PaymentProvider {
  readonly key = "mock";
  readonly mode = "sandbox" as const;
  readonly isMock = true;

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    void input;
    const providerPaymentId = `mock_pay_${randomUUID()}`;
    return {
      providerPaymentId,
      checkoutUrl: `${siteUrl}/checkout/pay/${providerPaymentId}`,
    };
  }

  verifyWebhook(
    rawBody: string,
    signature: string | null,
    headers?: Record<string, string>,
  ): PaymentEvent {
    void headers;
    if (!signature) {
      throw new Error("Missing mock webhook signature");
    }
    const expected = signMockWebhook(rawBody);
    if (!safeEqual(expected, signature)) {
      throw new Error("Invalid mock webhook signature");
    }
    const parsed = eventSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      throw new Error(`Invalid mock webhook payload: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}

export function createMockPaymentEvent(input: {
  paymentId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  type?: "payment.succeeded" | "payment.failed";
}): PaymentEvent {
  return {
    eventId: `mock_evt_${randomUUID()}`,
    type: input.type ?? "payment.succeeded",
    paymentId: input.paymentId,
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    createdAt: new Date().toISOString(),
  };
}

export function signedMockWebhook(event: PaymentEvent): {
  rawBody: string;
  signature: string;
} {
  const rawBody = JSON.stringify(event);
  return { rawBody, signature: signMockWebhook(rawBody) };
}
