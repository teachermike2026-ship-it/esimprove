import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailResult, EmailTransport } from "@/lib/integrations/email/types";
import { hasRedactedContent, redactSensitiveEmailText } from "@/lib/integrations/email/redact";

export class MockEmailTransport implements EmailTransport {
  readonly key = "mock";
  readonly mode = "local-logger" as const;
  readonly isMock = true;

  async send(message: EmailMessage): Promise<EmailResult> {
    const id = `mock_email_${randomUUID()}`;
    const safeText = redactSensitiveEmailText(message.text);
    const redactionNote = hasRedactedContent(message.text, safeText)
      ? "\n[actionable link/token redacted from this local log]"
      : "";
    console.info(
      [
        "",
        "──────── MOCK EMAIL (NOT SENT) ────────",
        `id: ${id}`,
        `to: ${message.to}`,
        `template: ${message.template}`,
        `subject: ${message.subject}`,
        "",
        safeText,
        redactionNote,
        "───────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { id, mode: "local-logger" };
  }
}
