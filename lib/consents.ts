import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { userConsents } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { recordConsentEvent } from "@/lib/consent";

export type ConsentPurpose =
  | "marketing"
  | "analytics"
  | "communications"
  | "terms"
  | "privacy"
  | "age";

export interface RecordConsentInput {
  userId: string;
  purpose: ConsentPurpose;
  version: string;
  accepted: boolean;
  surface?: string;
  ipHash?: string | null;
  userAgent?: string | null;
}

export async function recordConsent(
  db: Database,
  input: RecordConsentInput,
): Promise<void> {
  const now = new Date();
  const existing = await db
    .select()
    .from(userConsents)
    .where(
      and(
        eq(userConsents.userId, input.userId),
        eq(userConsents.purpose, input.purpose),
        eq(userConsents.version, input.version),
      ),
    )
    .limit(1);
  const previous = existing[0];
  if (previous) {
    await db
      .update(userConsents)
      .set({
        accepted: input.accepted,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
        updatedAt: now,
      })
      .where(eq(userConsents.id, previous.id));
  } else {
    await db.insert(userConsents).values({
      id: newId("consent"),
      userId: input.userId,
      purpose: input.purpose,
      version: input.version,
      accepted: input.accepted,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Append-only evidence, including withdrawals. The current-state row above
  // makes reads fast; this event stream preserves the history.
  await recordConsentEvent(db, {
    subjectType: "user",
    subjectId: input.userId,
    purpose: input.purpose,
    version: input.version,
    granted: input.accepted,
    surface: input.surface ?? "account",
    ipHash: input.ipHash ?? null,
    userAgent: input.userAgent ?? null,
  });
}

export async function getConsent(
  db: Database,
  userId: string,
  purpose: ConsentPurpose,
  version: string,
) {
  const rows = await db
    .select()
    .from(userConsents)
    .where(
      and(
        eq(userConsents.userId, userId),
        eq(userConsents.purpose, purpose),
        eq(userConsents.version, version),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function hasConsent(
  db: Database,
  userId: string,
  purpose: ConsentPurpose,
  version: string,
): Promise<boolean> {
  const row = await getConsent(db, userId, purpose, version);
  return row?.accepted ?? false;
}
