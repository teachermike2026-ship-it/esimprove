"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { requestMeta } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { recordConsent } from "@/lib/consents";
import { loadLegalSettings } from "@/lib/legal";
import {
  createEmailSubscription,
  unsubscribeEmailAsAdmin,
} from "@/lib/email-subscriptions";
import { getOrCreateUserPreferences, updateUserPreferences } from "@/lib/user-preferences";
import { formString, profileSchema, zodMessage } from "@/lib/validation";

export type ProfileFormState = {
  ok?: boolean;
  error?: string;
};

export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({
    name: formString(formData, "name"),
    locale: formString(formData, "locale"),
    marketing: formString(formData, "marketing"),
    productUpdates: formString(formData, "productUpdates"),
    orderUpdates: formString(formData, "orderUpdates"),
  });
  if (!parsed.success) return { error: zodMessage(parsed.error) };

  const user = await requireUser("/portal/profile");
  const db = await getDb();
  const meta = await requestMeta();
  const legal = await loadLegalSettings(db);
  const marketingOptIn = parsed.data.marketing === "on";
  await db
    .update(users)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const previous = await getOrCreateUserPreferences(db, user.id);
  await updateUserPreferences(db, user.id, {
    locale: parsed.data.locale,
    marketingOptIn,
    productUpdatesOptIn: parsed.data.productUpdates === "on",
    orderUpdatesOptIn: parsed.data.orderUpdates === "on",
  });

  if (marketingOptIn && !previous.marketingOptIn) {
    await createEmailSubscription(db, {
      email: user.email,
      userId: user.id,
      source: "account_preferences",
      consentVersion: legal.marketingConsentVersion,
    });
  } else if (!marketingOptIn && previous.marketingOptIn) {
    await unsubscribeEmailAsAdmin(db, user.email, "account_preferences");
  }
  if (marketingOptIn !== previous.marketingOptIn) {
    await recordConsent(db, {
      userId: user.id,
      purpose: "marketing",
      version: legal.marketingConsentVersion,
      accepted: marketingOptIn,
      surface: "account_preferences",
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    });
  }

  await recordAudit(db, {
    actorType: "user",
    actorId: user.id,
    action: "account.profile_update",
    entityType: "user",
    entityId: user.id,
    metadata: {
      marketingOptIn,
      productUpdatesOptIn: parsed.data.productUpdates === "on",
      orderUpdatesOptIn: parsed.data.orderUpdates === "on",
      locale: parsed.data.locale,
    },
  });
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  return { ok: true };
}
