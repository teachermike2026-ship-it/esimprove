import { after, NextResponse, type NextRequest } from "next/server";
import { WebhookVerificationError } from "@whop/sdk/helpers";
import { getDb } from "@/lib/db/client";
import { getWhopRuntimeConfig } from "@/lib/integrations/payment/whop";
import { WhopWebhookPayloadError } from "@/lib/integrations/payment/whop-webhook";
import { handleWhopWebhook } from "@/lib/payments/whop-webhooks";
import { runOutboxAndJobs } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whop sends Standard Webhooks requests. The signature covers the exact request
 * body and the `webhook-id` / `webhook-timestamp` headers, so the body must be
 * read as text and never re-serialized. Whop can only confirm a payment through
 * this verified route; a browser redirect never changes payment status.
 *
 * Responses: 2xx means "processed or deliberately ignored" (Whop stops
 * retrying). 400 means the request is invalid. 503 means receiving is not
 * configured. 500 means a temporary server error, which Whop retries.
 */
export async function POST(request: NextRequest) {
  const secret = getWhopRuntimeConfig().webhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook receiving is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  try {
    const db = await getDb();
    // Whop requires a 2xx within 5 seconds. Fulfillment (supplier + email)
    // runs after the response; the scheduled /api/jobs/run worker retries it.
    const result = await handleWhopWebhook(db, rawBody, headers, secret, {
      runFulfillment: false,
    });
    if (result.fulfillmentQueued) {
      after(async () => {
        try {
          await runOutboxAndJobs(db);
        } catch (error) {
          console.error(
            "Fulfillment after Whop webhook failed; the scheduled job will retry",
            error instanceof Error ? error.name : "unknown error",
          );
        }
      });
    }
    return NextResponse.json(
      {
        received: true,
        duplicate: result.duplicate,
        ...(result.ignored ? { ignored: true } : {}),
        ...(result.reviewRequired ? { review: true } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      // Never echo the verification reason; it can describe expected signature
      // material. Log only the error class.
      console.error("Whop webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    if (error instanceof WhopWebhookPayloadError) {
      console.error(`Whop webhook rejected: ${error.message}`);
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    console.error(
      "Whop webhook processing failed",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown error",
    );
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
