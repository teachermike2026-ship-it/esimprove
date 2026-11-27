/**
 * Website-first eSIM delivery: the QR code is released on the order page as
 * soon as fulfillment is confirmed; email is optional and can never block it.
 * Uses the mock supplier and fake email transports only.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { emailEvents, esims, fulfillmentJobs, orderItems, orders, plans } from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import { simulateMockPayment } from "@/lib/payments";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import { getOrderItems } from "@/lib/orders";
import { buildActivation, isOrderItemDelivered } from "@/lib/esim-activation";
import { setEmailTransportOverride } from "@/lib/integrations/email";
import type { EmailMessage, EmailTransport } from "@/lib/integrations/email/types";
import {
  RESEND_API_URL,
  ResendEmailError,
  ResendEmailTransport,
  resendConfigFromEnv,
  resendIdempotencyKey,
} from "@/lib/integrations/email/resend";
import { makeTestDb } from "./helpers/db";

class FailingEmail implements EmailTransport {
  readonly key = "failing";
  readonly mode = "live" as const;
  readonly isMock = false;
  calls = 0;
  async send(): Promise<never> {
    this.calls += 1;
    throw new ResendEmailError("Resend rejected the email (429 daily_quota_exceeded)", 429, "daily_quota_exceeded");
  }
}

describe("website-first eSIM delivery", () => {
  let handle: DatabaseHandle;
  // Creating the in-memory database is slow on a loaded machine.
  beforeAll(async () => {
    handle = await makeTestDb();
  }, 180_000);
  afterAll(async () => handle.close());
  afterEach(() => setEmailTransportOverride(null));

  async function paidOrder(key: string) {
    const db = handle.db;
    const cart = await getOrCreateCart(db);
    const plan = await db.query.plans.findFirst({ where: eq(plans.supplierKey, "mock") });
    await addCartItem(db, cart.cartId, plan!.id, 1);
    const checkout = await createCheckout(db, { cartToken: cart.token, email: `${key}@example.com`, name: "Delivery Test", country: "US", idempotencyKey: key });
    await simulateMockPayment(db, checkout.paymentId, "success");
    await runOutboxAndJobs(handle.db);
    await runOutboxAndJobs(handle.db);
    return checkout.orderId;
  }

  it("delivers the QR code on the website even when the email provider fails", async () => {
    const failing = new FailingEmail();
    setEmailTransportOverride(failing);
    const orderId = await paidOrder("deliver-email-fails");

    const order = (await handle.db.select().from(orders).where(eq(orders.id, orderId)))[0]!;
    expect(order.fulfillmentStatus).toBe("delivered");
    const jobs = await handle.db.select().from(fulfillmentJobs).where(eq(fulfillmentJobs.orderId, orderId));
    expect(jobs.map((job) => job.status)).toEqual(["delivered"]);

    // The order page lists the eSIM, and its QR code can be built.
    const items = await getOrderItems(handle.db, orderId);
    expect(items[0]!.esims).toHaveLength(1);
    const esim = (await handle.db.select().from(esims).where(eq(esims.id, items[0]!.esims[0]!.id)))[0]!;
    const activation = await buildActivation(esim);
    expect(activation.lpa).toMatch(/^LPA:1\$/);
    expect(activation.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // The email attempt was made once, failed, and was only recorded.
    expect(failing.calls).toBe(1);
    const mail = await handle.db.select().from(emailEvents).where(eq(emailEvents.orderId, orderId));
    expect(mail.find((row) => row.template === "esim.delivery")?.status).toBe("failed");

    // Running the worker again neither re-orders nor re-sends.
    await runOutboxAndJobs(handle.db);
    expect(failing.calls).toBe(1);
  });

  it("emails the QR code and activation code as a backup, but never stores the code", async () => {
    const sent: EmailMessage[] = [];
    setEmailTransportOverride({
      key: "capture",
      mode: "live",
      isMock: false,
      async send(message: EmailMessage) {
        sent.push(message);
        return { id: "email_capture_1", mode: "live" as const };
      },
    });
    const orderId = await paidOrder("deliver-email-qr");
    const message = sent.find((item) => item.template === "esim.delivery")!;
    expect(message).toBeDefined();

    // Inline QR image plus a PNG attachment, and the manual code in both versions.
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments![0]).toMatchObject({ contentType: "image/png", contentId: "esim-qr-1" });
    expect(Buffer.from(message.attachments![0]!.contentBase64, "base64").subarray(1, 4).toString()).toBe("PNG");
    expect(message.html).toContain('src="cid:esim-qr-1"');
    expect(message.text).toMatch(/LPA:1\$/);
    expect(message.html).toMatch(/LPA:1\$/);

    // The stored copy has neither the activation code nor the order access token.
    const stored = (await handle.db.select().from(emailEvents).where(eq(emailEvents.orderId, orderId))).find(
      (row) => row.template === "esim.delivery",
    )!;
    expect(stored.status).toBe("sent");
    expect(stored.bodyText).not.toMatch(/LPA:1\$/);
    expect(stored.bodyText).toContain("[eSIM activation code redacted]");
    expect(stored.bodyText).not.toMatch(/token=(?!\[redacted\])/);
  });

  it("never lists or releases an eSIM before fulfillment is confirmed", async () => {
    const orderId = await paidOrder("deliver-not-confirmed");
    const items = await handle.db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    // Simulate a stored supplier profile whose fulfillment job is not delivered.
    await handle.db.update(fulfillmentJobs).set({ status: "processing" }).where(eq(fulfillmentJobs.orderItemId, items[0]!.id));
    expect(await isOrderItemDelivered(handle.db, items[0]!.id)).toBe(false);
    const view = await getOrderItems(handle.db, orderId);
    expect(view[0]!.esims).toHaveLength(0);
    // Back to delivered: the eSIM is shown again.
    await handle.db.update(fulfillmentJobs).set({ status: "delivered" }).where(eq(fulfillmentJobs.orderItemId, items[0]!.id));
    expect((await getOrderItems(handle.db, orderId))[0]!.esims).toHaveLength(1);
  });

  it("keeps the activation pages and the order page behind the delivered check", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["app/orders/[orderNumber]/esim/[esimId]/page.tsx", "app/portal/esims/[esimId]/page.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toContain("isOrderItemDelivered(db, row.item.id)");
    }
    for (const file of ["app/checkout/success/page.tsx", "app/orders/[orderNumber]/page.tsx", "app/portal/orders/[orderNumber]/page.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toContain("showActivation");
    }
    // Admin pages never render the customer QR code.
    expect(readFileSync("app/admin/orders/[orderNumber]/page.tsx", "utf8")).not.toContain("showActivation");
  });
});

describe("optional Resend transport (free plan)", () => {
  const message: EmailMessage = { to: "Traveler@Example.com", subject: "Your eSIM is ready", text: "Open your order", template: "esim.delivery", orderId: "order_1" };

  it("sends one email with an idempotency key and never exposes the key in errors", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    }) as unknown as typeof fetch;
    const transport = new ResendEmailTransport({ apiKey: "re_synthetic_key", from: "ESIMPROVE <orders@example.com>" }, fakeFetch);
    const result = await transport.send(message);
    expect(result).toEqual({ id: "email_123", mode: "live" });
    expect(requests[0]!.url).toBe(RESEND_API_URL);
    const headers = requests[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_synthetic_key");
    expect(headers["Idempotency-Key"]).toBe(resendIdempotencyKey(message));
    expect(headers["Idempotency-Key"].length).toBeLessThanOrEqual(256);
    expect(JSON.parse(String(requests[0]!.init.body))).toMatchObject({ to: ["Traveler@Example.com"], subject: "Your eSIM is ready" });
  });

  it("reports free-plan quota errors as a normal failure", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ name: "daily_quota_exceeded", message: "quota" }), { status: 429 })) as unknown as typeof fetch;
    const transport = new ResendEmailTransport({ apiKey: "re_synthetic_key", from: "x@example.com" }, fakeFetch);
    const error = await transport.send(message).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ResendEmailError);
    expect((error as ResendEmailError).code).toBe("daily_quota_exceeded");
    expect(String((error as Error).message)).not.toContain("re_synthetic_key");
  });

  it("sends the QR code as an inline image attachment", async () => {
    let body: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "email_789" }), { status: 200 });
    }) as unknown as typeof fetch;
    await new ResendEmailTransport({ apiKey: "re_k", from: "x@example.com" }, fakeFetch).send({
      ...message,
      html: '<img src="cid:esim-qr-1">',
      attachments: [{ filename: "esim-qr.png", contentBase64: "iVBORw0KGgo=", contentType: "image/png", contentId: "esim-qr-1" }],
    });
    expect(body.html).toBe('<img src="cid:esim-qr-1">');
    expect(body.attachments).toEqual([
      { filename: "esim-qr.png", content: "iVBORw0KGgo=", content_type: "image/png", content_id: "esim-qr-1" },
    ]);
  });

  it("redacts activation codes from logged or stored text", async () => {
    const { redactSensitiveEmailText } = await import("@/lib/integrations/email/redact");
    expect(redactSensitiveEmailText("code: LPA:1$smdp.example.com$ABC-123 end")).toBe("code: [eSIM activation code redacted] end");
  });

  it("can route every email to a test inbox", async () => {
    let body: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "email_456" }), { status: 200 });
    }) as unknown as typeof fetch;
    await new ResendEmailTransport({ apiKey: "re_k", from: "x@example.com", testRecipient: "inbox@example.com" }, fakeFetch).send(message);
    expect(body.to).toEqual(["inbox@example.com"]);
  });

  it("is only configured with a re_ key and a sender address", () => {
    const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
    try {
      process.env.RESEND_API_KEY = "";
      process.env.EMAIL_FROM = "x@example.com";
      expect(resendConfigFromEnv()).toBeNull();
      process.env.RESEND_API_KEY = "re_abc";
      process.env.EMAIL_FROM = "";
      expect(resendConfigFromEnv()).toBeNull();
      process.env.EMAIL_FROM = "x@example.com";
      expect(resendConfigFromEnv()).toMatchObject({ apiKey: "re_abc", from: "x@example.com" });
    } finally {
      if (saved.key === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = saved.key;
      if (saved.from === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = saved.from;
    }
  });
});
