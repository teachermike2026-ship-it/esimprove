import { flags } from "@/lib/config";
import { MockEmailTransport } from "@/lib/integrations/email/mock";
import { DisabledLiveEmailTransport } from "@/lib/integrations/email/disabled";
import type { EmailTransport } from "@/lib/integrations/email/types";

let transport: EmailTransport | undefined;

export function getEmailTransport(): EmailTransport {
  if (!transport) {
    transport = flags.emailLive ? new DisabledLiveEmailTransport() : new MockEmailTransport();
  }
  return transport;
}
