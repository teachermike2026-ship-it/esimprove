import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import type { EncryptedSecret } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { hashIdentifier, hashToken, randomToken } from "@/lib/crypto";
import { sessionCookieName, siteUrl } from "@/lib/config";
import { newId } from "@/lib/ids";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  totpEnabled: boolean;
  totpSecretEncrypted: EncryptedSecret | null;
}

export interface ActiveSession {
  id: string;
  tokenHash: string;
  pendingTwoFactor: boolean;
  expiresAt: Date;
  user: SessionUser;
}

export interface CreatedSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export async function createSession(
  db: Database,
  userId: string,
  options: {
    pendingTwoFactor?: boolean;
    ttlMinutes: number;
    ipHash?: string | null;
    userAgent?: string | null;
  },
): Promise<CreatedSession> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + options.ttlMinutes * 60_000);
  const sessionId = newId("sess");
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash: hashToken(token),
    pendingTwoFactor: options.pendingTwoFactor ?? false,
    ipHash: options.ipHash ?? null,
    userAgent: options.userAgent?.slice(0, 255) ?? null,
    expiresAt,
  });
  return { token, sessionId, expiresAt };
}

export async function getSessionByToken(
  db: Database,
  token: string,
): Promise<ActiveSession | null> {
  const rows = await db
    .select({
      id: sessions.id,
      tokenHash: sessions.tokenHash,
      pendingTwoFactor: sessions.pendingTwoFactor,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      totpEnabled: users.totpEnabled,
      totpSecretEncrypted: users.totpSecretEncrypted,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    pendingTwoFactor: row.pendingTwoFactor,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      totpEnabled: row.totpEnabled,
      totpSecretEncrypted: row.totpSecretEncrypted ?? null,
    },
  };
}

export async function getCurrentSession(): Promise<ActiveSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;
  const db = await getDb();
  return getSessionByToken(db, token);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  if (!session || session.pendingTwoFactor) return null;
  return session.user;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), token, {
    httpOnly: true,
    // Tie the Secure flag to the configured public origin, not NODE_ENV. A
    // local `next start` runs a production build over http; a Secure cookie
    // there would break the demo login in a browser.
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), "", {
    httpOnly: true,
    // Tie the Secure flag to the configured public origin, not NODE_ENV. A
    // local `next start` runs a production build over http; a Secure cookie
    // there would break the demo login in a browser.
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function deleteSession(db: Database, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function promotePendingSession(
  db: Database,
  sessionId: string,
  ttlMinutes: number,
): Promise<Date> {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  await db
    .update(sessions)
    .set({ pendingTwoFactor: false, expiresAt })
    .where(eq(sessions.id, sessionId));
  return expiresAt;
}

export async function requestMeta(): Promise<{ ipHash: string; userAgent: string }> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown";
  return {
    ipHash: hashIdentifier(ip),
    userAgent: headerStore.get("user-agent") || "unknown",
  };
}
