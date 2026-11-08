"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { recordAudit } from "@/lib/audit";
import {
  findSubscriptionByUnsubscribeToken,
  unsubscribeByToken,
} from "@/lib/email-subscriptions";
import { formString } from "@/lib/validation";

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const token = formString(formData, "token").trim();
  if (!token || token.length > 200) {
    redirect("/unsubscribe?error=missing");
  }

  const db = await getDb();
  const existing = await findSubscriptionByUnsubscribeToken(db, token);
  if (!existing) {
    redirect(`/unsubscribe?token=${encodeURIComponent(token)}&error=invalid`);
  }

  const subscription = await unsubscribeByToken(db, token, "public_unsubscribe_link");
  if (!subscription) {
    redirect(`/unsubscribe?token=${encodeURIComponent(token)}&error=invalid`);
  }

  await recordAudit(db, {
    actorType: "anonymous",
    action: "email.unsubscribed",
    entityType: "email_subscription",
    entityId: subscription.id,
    metadata: { source: "public_unsubscribe_link", status: "unsubscribed" },
  });

  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&done=1`);
}
