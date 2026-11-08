import { flags, mockCommerceAllowed } from "@/lib/config";
import { MockEmailTransport } from "@/lib/integrations/email/mock";
import {
  DisabledLiveEmailTransport,
  DisabledUnconfiguredEmailTransport,
} from "@/lib/integrations/email/disabled";
import type { EmailTransport } from "@/lib/integrations/email/types";

let transport: EmailTransport | undefined;

export function getEmailTransport(): EmailTransport {
  if (!transport) {
    if (flags.emailLive) {
      transport = new DisabledLiveEmailTransport();
    } else if (!mockCommerceAllowed) {
      transport = new DisabledUnconfiguredEmailTransport();
    } else {
      transport = new MockEmailTransport();
    }
  }
  return transport;
}
