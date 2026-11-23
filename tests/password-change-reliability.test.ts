import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { seedDemoData } from "@/lib/db/seed";
import { users, sessions, passwordResets } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { hashToken, randomToken } from "@/lib/crypto";

const jar = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => {
  const store = {
    get: (name: string) =>
      name.endsWith("_session") && jar.token
        ? { name, value: jar.token }
        : undefined,
    set: (name: string, value: string) => {
      if (name.endsWith("_session")) jar.token = value || null;
    },
    delete: () => {
      jar.token = null;
    },
  };
  return {
    cookies: async () => store,
    headers: async () => new Headers({ "user-agent": "vitest-password-change" }),
  };
});

function changeForm(currentPassword: string, password: string, confirmPassword: string): FormData {
  const form = new FormData();
  form.set("currentPassword", currentPassword);
  form.set("password", password);
  form.set("confirmPassword", confirmPassword);
  return form;
}

function resetForm(token: string, password: string, confirmPassword: string): FormData {
  const form = new FormData();
  form.set("token", token);
  form.set("password", password);
  form.set("confirmPassword", confirmPassword);
  return form;
}

const ADMIN_PASSWORD = "TempOwner!Pass987";
const ADMIN_EMAIL = "owner@demo.local";

describe("password change reliability regression tests", () => {
  let handle: DatabaseHandle;
  let adminId: string;

  beforeAll(async () => {
    handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
    await runMigrations(handle.client, handle.dialect);
    await seedDemoData(handle.db, {
      adminEmail: ADMIN_EMAIL,
      adminPassword: ADMIN_PASSWORD,
      adminTotpSecret: "JBSWY3DPEHPK3PXP",
    });
    const admin = await handle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);
    adminId = admin[0].id;
    // Simulate the owner-bootstrap state: the account is provisioned with a
    // temporary password and must rotate before the account is usable.
    await handle.db
      .update(users)
      .set({ passwordChangeRequired: true, updatedAt: new Date() })
      .where(eq(users.id, adminId));
    (
      globalThis as typeof globalThis & { __esimproveDbPromise?: Promise<DatabaseHandle> }
    ).__esimproveDbPromise = Promise.resolve(handle);
  });

  afterAll(async () => {
    const globalWithDb = globalThis as typeof globalThis & {
      __esimproveDbPromise?: Promise<DatabaseHandle>;
    };
    globalWithDb.__esimproveDbPromise = undefined;
    await handle.close();
  });

  it("changes the password of a password-change-required admin and preserves role and identity", async () => {
    jar.token = null;
    const { createSession } = await import("@/lib/auth/session");
    const created = await createSession(handle.db, adminId, {
      ttlMinutes: 30,
      ipHash: "ip-hash",
      userAgent: "vitest-password-change",
    });
    expect(created.token).toBeTruthy();
    jar.token = created.token;

    const { changePasswordAction } = await import("@/lib/auth/actions");
    const result = await changePasswordAction(
      {},
      changeForm(ADMIN_PASSWORD, "Rotated!Pass123456", "Rotated!Pass123456"),
    );
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const rows = await handle.db.select().from(users).where(eq(users.id, adminId)).limit(1);
    expect(rows[0].passwordChangeRequired).toBe(false);
    expect(rows[0].role).toBe("admin");
    expect(rows[0].email).toBe(ADMIN_EMAIL);
    expect(await verifyPassword(ADMIN_PASSWORD, rows[0].passwordHash)).toBe(false);
    expect(await verifyPassword("Rotated!Pass123456", rows[0].passwordHash)).toBe(true);

    const remaining = await handle.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, adminId));
    expect(remaining).toHaveLength(0);
  });

  it("rejects a password change when the current password is wrong and changes nothing", async () => {
    jar.token = null;
    const { createSession } = await import("@/lib/auth/session");
    const created = await createSession(handle.db, adminId, {
      ttlMinutes: 30,
      ipHash: "ip-hash",
      userAgent: "vitest-password-change",
    });
    jar.token = created.token;

    const before = await handle.db.select().from(users).where(eq(users.id, adminId)).limit(1);
    const { changePasswordAction } = await import("@/lib/auth/actions");
    const result = await changePasswordAction(
      {},
      changeForm("not-my-password", "Another!Pass98765", "Another!Pass98765"),
    );
    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/current password/i);

    const after = await handle.db.select().from(users).where(eq(users.id, adminId)).limit(1);
    expect(after[0].passwordHash).toBe(before[0].passwordHash);
    expect(after[0].passwordChangeRequired).toBe(false);
  });

  it("a reset link rotates the hash, consumes the token, deletes sessions and clears the flag", async () => {
    jar.token = null;
    const { createSession } = await import("@/lib/auth/session");
    const created = await createSession(handle.db, adminId, {
      ttlMinutes: 30,
      ipHash: "ip-hash",
      userAgent: "vitest-password-change",
    });
    jar.token = created.token;

    await handle.db
      .update(users)
      .set({ passwordChangeRequired: true, updatedAt: new Date() })
      .where(eq(users.id, adminId));

    const token = randomToken(32);
    const now = new Date();
    await handle.db.insert(passwordResets).values({
      id: crypto.randomUUID(),
      userId: adminId,
      tokenHash: hashToken(token),
      purpose: "password_reset",
      expiresAt: new Date(now.getTime() + 15 * 60_000),
      consumedAt: null,
      createdAt: now,
    });

    const { resetPasswordAction } = await import("@/lib/auth/actions");
    const first = await resetPasswordAction(
      {},
      resetForm(token, "Reset!Pass123456", "Reset!Pass123456"),
    );
    expect(first.error).toBeUndefined();
    expect(first.success).toBe(true);

    const rows = await handle.db.select().from(users).where(eq(users.id, adminId)).limit(1);
    expect(rows[0].passwordChangeRequired).toBe(false);
    expect(rows[0].role).toBe("admin");
    expect(await verifyPassword("Reset!Pass123456", rows[0].passwordHash)).toBe(true);

    const remainingSessions = await handle.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, adminId));
    expect(remainingSessions).toHaveLength(0);

    // A consumed reset link cannot be reused.
    const second = await resetPasswordAction(
      {},
      resetForm(token, "Second!Pass12345", "Second!Pass12345"),
    );
    expect(second.success).toBeUndefined();
    expect(second.error).toMatch(/invalid or has already been used/i);
  });
});
