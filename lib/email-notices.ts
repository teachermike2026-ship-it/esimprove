import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { emailEvents } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { getEmailTransport } from "@/lib/integrations/email";
import { redactSensitiveEmailText } from "@/lib/integrations/email/redact";
import type { EmailTemplateKey } from "@/lib/email-templates";

export interface SendTransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  template: EmailTemplateKey;
  orderId?: string | null;
}

export interface SendTransactionalEmailResult {
  ok: boolean;
  emailEventId: string;
}

/**
 * Persist the redacted message, then hand the actionable text to the configured
 * transport. The mock transport redacts links again before logging, so a token
 * cannot leak through either path. Delivery failures are recorded and returned
 * rather than crashing the surrounding business transaction.
 */
export async function sendTransactionalEmail(
  db: Database,
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const emailEventId = newId("email");
  // Guest orders may have no email address at all. Nothing is sent or logged;
  // the customer reads the same information on their secure order page.
  if (!input.to.trim()) return { ok: false, emailEventId };
  const safeBody = redactSensitiveEmailText(input.text);
  await db.insert(emailEvents).values({
    id: emailEventId,
    orderId: input.orderId ?? null,
    template: input.template,
    recipient: input.to,
    subject: input.subject,
    bodyText: safeBody,
    status: "queued",
  });

  try {
    const result = await getEmailTransport().send({
      to: input.to,
      subject: input.subject,
      text: input.text,
      template: input.template,
      orderId: input.orderId ?? undefined,
    });
    // "sent" only when a live provider accepted it; otherwise only logged.
    await db
      .update(emailEvents)
      .set({
        status: result.mode === "live" ? "sent" : "logged",
        sentAt: new Date(),
        providerMessageId: result.mode === "live" ? result.id : null,
      })
      .where(eq(emailEvents.id, emailEventId));
    return { ok: true, emailEventId };
  } catch (error) {
    const safeError = redactSensitiveEmailText(
      error instanceof Error ? error.message : String(error),
    ).slice(0, 500);
    await db
      .update(emailEvents)
      .set({
        status: "failed",
        bodyText: `${safeBody}\n\nTransport error: ${safeError}`,
        providerResponse: safeError,
      })
      .where(eq(emailEvents.id, emailEventId));
    return { ok: false, emailEventId };
  }
}
