import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailResult, EmailTransport } from "@/lib/integrations/email/types";

export class MockEmailTransport implements EmailTransport {
  readonly key = "mock";
  readonly mode = "local-logger" as const;
  readonly isMock = true;

  async send(message: EmailMessage): Promise<EmailResult> {
    const id = `mock_email_${randomUUID()}`;
    console.info(
      [
        "",
        "──────── MOCK EMAIL (NOT SENT) ────────",
        `id: ${id}`,
        `to: ${message.to}`,
        `template: ${message.template}`,
        `subject: ${message.subject}`,
        "",
        message.text,
        "───────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { id, mode: "local-logger" };
  }
}
