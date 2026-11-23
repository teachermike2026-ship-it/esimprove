import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { handlePaymentWebhook } from "@/lib/payments";
import { getWhopPaymentProvider } from "@/lib/integrations/payments";
import { isWhopWebhookConfigured } from "@/lib/integrations/payment/whop";
import { UnsupportedWhopEventError } from "@/lib/integrations/payment/whop";
import { PaymentUnavailableError } from "@/lib/integrations/payments/types";
import { WebhookVerificationError } from "@whop/sdk/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whop sends Standard Webhooks requests. The signature covers the exact request
 * body, so the body must be read as text and never re-serialized. Whop is only
 * allowed to confirm payment through this verified route; a browser redirect
 * never changes payment status.
 */
export async function POST(request: NextRequest) {
  if (!isWhopWebhookConfigured()) {
    return NextResponse.json(
      { error: "Webhook receiving is not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };
  const signature = headers["webhook-signature"] || null;

  try {
    const db = await getDb();
    const result = await handlePaymentWebhook(db, rawBody, signature, {
      headers,
      provider: getWhopPaymentProvider(),
    });
    return NextResponse.json(
      { received: true, duplicate: result.duplicate },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof UnsupportedWhopEventError) {
      // The signature was valid but the event is outside this integration's
      // scope. Acknowledge it so Whop does not retry it indefinitely.
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }
    if (error instanceof WebhookVerificationError) {
      // Never echo the verification reason; it can describe expected signature
      // material. Log only the error class.
      console.error("Whop webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (error instanceof PaymentUnavailableError) {
      console.error("Whop webhook is not configured");
      return NextResponse.json(
        { error: "Webhook receiving is not configured" },
        { status: 503 },
      );
    }
    console.error(
      "Whop webhook rejected",
      error instanceof Error ? error.name : "unknown error",
    );
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}