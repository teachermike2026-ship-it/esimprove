import { desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { emailSubscriptions, type EmailSubscriptionRow } from "@/lib/db/schema";
import { hashToken, randomToken } from "@/lib/crypto";
import { newId } from "@/lib/ids";
import { normalizeEmail } from "@/lib/validation";

export interface CreateSubscriptionInput {
  email: string;
  userId?: string | null;
  source: string;
  consentVersion: string;
}

export interface CreatedSubscription {
  subscription: EmailSubscriptionRow;
  /** Raw unsubscribe token. Send it by email; never persist or log it. */
  unsubscribeToken: string;
}

export async function createEmailSubscription(
  db: Database,
  input: CreateSubscriptionInput,
): Promise<CreatedSubscription> {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("A valid email address is required");
  const token = randomToken(32);
  const now = new Date();
  const values = {
    id: newId("esub"),
    email,
    userId: input.userId ?? null,
    status: "subscribed",
    source: input.source.slice(0, 120),
    consentVersion: input.consentVersion.slice(0, 80),
    unsubscribeTokenHash: hashToken(token),
    subscribedAt: now,
    unsubscribedAt: null,
    unsubscribeReason: "",
    updatedAt: now,
  };

  const rows = await db
    .insert(emailSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: emailSubscriptions.email,
      set: {
        userId: values.userId,
        status: "subscribed",
        source: values.source,
        consentVersion: values.consentVersion,
        unsubscribeTokenHash: values.unsubscribeTokenHash,
        subscribedAt: now,
        unsubscribedAt: null,
        unsubscribeReason: "",
        updatedAt: now,
      },
    })
    .returning();

  return { subscription: rows[0]!, unsubscribeToken: token };
}

export async function findSubscriptionByUnsubscribeToken(
  db: Database,
  token: string,
): Promise<EmailSubscriptionRow | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const rows = await db
    .select()
    .from(emailSubscriptions)
    .where(eq(emailSubscriptions.unsubscribeTokenHash, hashToken(token)))
    .limit(1);
  return rows[0] ?? null;
}

export async function unsubscribeByToken(
  db: Database,
  token: string,
  reason = "unsubscribe_link",
): Promise<EmailSubscriptionRow | null> {
  const subscription = await findSubscriptionByUnsubscribeToken(db, token);
  if (!subscription) return null;
  // Repeated unsubscribe requests are idempotent: keep the original timestamp
  // and reason instead of overwriting the evidence on every click.
  if (subscription.status === "unsubscribed") return subscription;
  const now = new Date();
  const rows = await db
    .update(emailSubscriptions)
    .set({
      status: "unsubscribed",
      unsubscribedAt: now,
      unsubscribeReason: reason.slice(0, 200),
      updatedAt: now,
    })
    .where(eq(emailSubscriptions.id, subscription.id))
    .returning();
  return rows[0] ?? null;
}

export async function unsubscribeEmailAsAdmin(
  db: Database,
  email: string,
  reason = "admin_action",
): Promise<EmailSubscriptionRow | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const existing = await db
    .select()
    .from(emailSubscriptions)
    .where(eq(emailSubscriptions.email, normalized))
    .limit(1);
  const subscription = existing[0];
  if (!subscription) return null;
  if (subscription.status === "unsubscribed") return subscription;
  const now = new Date();
  const rows = await db
    .update(emailSubscriptions)
    .set({
      status: "unsubscribed",
      unsubscribedAt: now,
      unsubscribeReason: reason.slice(0, 200),
      updatedAt: now,
    })
    .where(eq(emailSubscriptions.id, subscription.id))
    .returning();
  return rows[0] ?? null;
}

export async function listEmailSubscriptions(
  db: Database,
  limit = 100,
): Promise<EmailSubscriptionRow[]> {
  return db
    .select()
    .from(emailSubscriptions)
    .orderBy(desc(emailSubscriptions.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}
