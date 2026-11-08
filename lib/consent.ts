import { and, desc, eq, gte } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  consentEvents,
  cookieConsents,
  type ConsentEventRow,
  type CookieConsentRow,
} from "@/lib/db/schema";
import { hmacHex } from "@/lib/crypto";
import { analyticsHashSecret } from "@/lib/config";
import { newId } from "@/lib/ids";
import {
  CONSENT_VALIDITY_DAYS,
  type ConsentAction,
  type ConsentCategories,
} from "@/lib/legal";

const CONSENT_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function isConsentId(value: unknown): value is string {
  return typeof value === "string" && CONSENT_ID_PATTERN.test(value);
}

/**
 * The browser holds a random, pseudonymous consent id. The server stores only
 * an HMAC of that id, never the raw value and never a raw IP address.
 */
export function hashConsentSubject(consentId: string): string {
  return hmacHex(consentId, analyticsHashSecret());
}

export interface RecordCookieConsentInput {
  consentId: string;
  consentVersion: string;
  action: ConsentAction;
  categories: ConsentCategories;
  countryCode?: string | null;
  userAgent?: string | null;
}

export async function recordCookieConsent(
  db: Database,
  input: RecordCookieConsentInput,
): Promise<CookieConsentRow> {
  if (!isConsentId(input.consentId)) {
    throw new Error("Invalid consent id");
  }
  const subjectHash = hashConsentSubject(input.consentId);
  const now = new Date();
  const values = {
    id: newId("cconsent"),
    subjectHash,
    consentVersion: input.consentVersion,
    analytics: input.categories.analytics === true,
    marketing: input.categories.marketing === true,
    action: input.action,
    countryCode: input.countryCode ?? null,
    userAgent: input.userAgent?.slice(0, 255) ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const rows = await db
    .insert(cookieConsents)
    .values(values)
    .onConflictDoUpdate({
      target: cookieConsents.subjectHash,
      set: {
        consentVersion: values.consentVersion,
        analytics: values.analytics,
        marketing: values.marketing,
        action: values.action,
        countryCode: values.countryCode,
        userAgent: values.userAgent,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  await recordConsentEvent(db, {
    subjectType: "anonymous",
    subjectId: subjectHash,
    purpose: "cookie_analytics",
    version: input.consentVersion,
    granted: values.analytics,
    surface: "cookie_banner",
    userAgent: input.userAgent ?? null,
  });

  return rows[0]!;
}

export async function getCookieConsent(
  db: Database,
  consentId: string,
): Promise<CookieConsentRow | null> {
  if (!isConsentId(consentId)) return null;
  const rows = await db
    .select()
    .from(cookieConsents)
    .where(eq(cookieConsents.subjectHash, hashConsentSubject(consentId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Server-side evidence check used by /api/track. A consent value stored only in
 * the browser is never treated as evidence on its own.
 */
export async function hasAnalyticsConsent(
  db: Database,
  consentId: string,
  currentVersion: string,
  now = new Date(),
): Promise<boolean> {
  const row = await getCookieConsent(db, consentId);
  if (!row) return false;
  if (!row.analytics) return false;
  if (row.consentVersion !== currentVersion) return false;
  const ageMs = now.getTime() - row.updatedAt.getTime();
  return ageMs <= CONSENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
}

export interface RecordConsentEventInput {
  subjectType: "user" | "anonymous";
  subjectId: string;
  purpose: string;
  version: string;
  granted: boolean;
  surface?: string;
  ipHash?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
}

export async function recordConsentEvent(
  db: Database,
  input: RecordConsentEventInput,
): Promise<void> {
  await db.insert(consentEvents).values({
    id: newId("cevent"),
    subjectType: input.subjectType,
    subjectId: input.subjectId.slice(0, 200),
    purpose: input.purpose.slice(0, 80),
    version: input.version.slice(0, 80),
    granted: input.granted,
    surface: (input.surface ?? "").slice(0, 120),
    ipHash: input.ipHash ?? null,
    userAgent: input.userAgent?.slice(0, 255) ?? null,
    createdAt: input.createdAt ?? new Date(),
  });
}

export async function listRecentConsentEvents(
  db: Database,
  limit = 25,
): Promise<ConsentEventRow[]> {
  return db
    .select()
    .from(consentEvents)
    .orderBy(desc(consentEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function listRecentCookieConsents(
  db: Database,
  sinceDays = 30,
): Promise<CookieConsentRow[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(cookieConsents)
    .where(and(gte(cookieConsents.updatedAt, since)))
    .orderBy(desc(cookieConsents.updatedAt))
    .limit(100);
}
