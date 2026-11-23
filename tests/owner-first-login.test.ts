import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { seedDemoData } from "@/lib/db/seed";
import { users } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { hashPassword } from "@/lib/auth/password";
import { encryptSecret } from "@/lib/crypto";
import { totpCode } from "@/lib/auth/totp";

const jar = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => {
  const store = {
    get: (name: string) =>
      name.endsWith("_session") && jar.token ? { name, value: jar.token } : undefined,
    set: (name: string, value: string) => {
      if (name.endsWith("_session")) jar.token = value || null;
    },
    delete: () => {
      jar.token = null;
    },
  };
  return {
    cookies: async () => store,
    headers: async () => new Headers({ "user-agent": "vitest-owner-first-login" }),
  };
});

type RedirectError = { digest?: string; message?: string };

async function catchRedirect(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (error) {
    const value = error as RedirectError;
    return `${value.digest ?? ""} ${value.message ?? ""}`;
  }
  throw new Error("Expected the action to redirect");
}

function ownerLoginForm(email: string, password: string, next = ""): FormData {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("next", next);
  return form;
}

function ownerTwoFactorForm(code: string, next = ""): FormData {
  const form = new FormData();
  form.set("code", code);
  form.set("next", next);
  return form;
}

describe("Owner first-login temporary password rotation", () => {
  let handle: DatabaseHandle;
  const ownerEmail = "owner-first-login@example.test";

  beforeAll(async () => {
    handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
    await runMigrations(handle.client, handle.dialect);
    await seedDemoData(handle.db, {
      adminEmail: "admin@demo.local",
      adminPassword: "DemoAdmin!2345",
      adminTotpSecret: "JBSWY3DPEHPK3PXP",
    });

    const now = new Date();
    await handle.db.insert(users).values({
      id: newId("user"),
      email: ownerEmail,
      name: "Owner First Login",
      passwordHash: await hashPassword("OwnerTemp!2345"),
      role: "admin",
      emailVerifiedAt: now,
      totpEnabled: true,
      totpSecretEncrypted: encryptSecret("JBSWY3DPEHPK3PXP"),
      passwordChangeRequired: true,
      createdAt: now,
      updatedAt: now,
    });

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

  it("routes a first-login administrator through TOTP before the set-password screen", async () => {
    jar.token = null;
    const { loginAction } = await import("@/lib/auth/actions");

    const loginRedirect = await catchRedirect(() =>
      loginAction({}, ownerLoginForm(ownerEmail, "OwnerTemp!2345", "/admin")),
    );
    expect(loginRedirect).toContain("/login/2fa");

    const pendingToken = jar.token;
    expect(pendingToken).toBeTruthy();

    const { loginTwoFactorAction } = await import("@/lib/auth/actions");
    const pendingForm = new FormData();
    pendingForm.set("password", "SecureNew!3456");
    pendingForm.set("confirmPassword", "SecureNew!3456");
    expect((await (await import("@/lib/auth/actions")).setNewOwnerPasswordAction({}, pendingForm)).error).toBeTruthy();
    expect(await catchRedirect(() => (import("@/lib/auth/guards")).then((g) => g.requireAdmin("/admin")))).toContain("/login/2fa");
    const promoted = await catchRedirect(() =>
      loginTwoFactorAction({}, ownerTwoFactorForm(totpCode("JBSWY3DPEHPK3PXP"), "/portal")),
    );
    expect(promoted).toContain("/admin/set-password");

    const { requireAdmin } = await import("@/lib/auth/guards");
    const denied = await catchRedirect(() => requireAdmin("/admin"));
    expect(denied).toContain("/admin/set-password");
  });

  it("rolls back a password update when the transaction fails", async () => {
    const owner = (await handle.db.select().from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
    await expect(handle.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: "not-a-valid-hash" }).where(eq(users.id, owner.id));
      throw new Error("rollback verification");
    })).rejects.toThrow("rollback verification");
    const after = (await handle.db.select().from(users).where(eq(users.id, owner.id)).limit(1))[0];
    expect(after.passwordHash).toBe(owner.passwordHash);
    expect(after.passwordChangeRequired).toBe(owner.passwordChangeRequired);
  });

  it("rotates the temporary owner password and invalidates prior sessions", async () => {
    jar.token = null;
    const { loginAction, setNewOwnerPasswordAction } = await import("@/lib/auth/actions");
    const { requireAdmin } = await import("@/lib/auth/guards");
    const { verifyPassword } = await import("@/lib/auth/password");

    const loginRedirect = await catchRedirect(() =>
      loginAction({}, ownerLoginForm(ownerEmail, "OwnerTemp!2345", "/admin")),
    );
    expect(loginRedirect).toContain("/login/2fa");
    const pendingToken = jar.token;
    expect(pendingToken).toBeTruthy();

    const { loginTwoFactorAction } = await import("@/lib/auth/actions");
    const pendingForm = new FormData();
    pendingForm.set("password", "SecureNew!3456");
    pendingForm.set("confirmPassword", "SecureNew!3456");
    expect((await (await import("@/lib/auth/actions")).setNewOwnerPasswordAction({}, pendingForm)).error).toBeTruthy();
    expect(await catchRedirect(() => (import("@/lib/auth/guards")).then((g) => g.requireAdmin("/admin")))).toContain("/login/2fa");
    const promoted = await catchRedirect(() =>
      loginTwoFactorAction({}, ownerTwoFactorForm(totpCode("JBSWY3DPEHPK3PXP"), "/portal")),
    );
    expect(promoted).toContain("/admin/set-password");

    const passwordForm = new FormData();
    passwordForm.set("password", "OwnerNew!3456");
    passwordForm.set("confirmPassword", "OwnerNew!3456");
    const rotations = await Promise.all([
      setNewOwnerPasswordAction({}, passwordForm),
      setNewOwnerPasswordAction({}, passwordForm),
    ]);
    expect(rotations.filter((result) => result.success)).toHaveLength(1);
    expect(rotations.filter((result) => result.error)).toHaveLength(1);

    const owner = (
      await handle.db.select().from(users).where(eq(users.email, ownerEmail)).limit(1)
    )[0];
    expect(owner.passwordChangeRequired).toBe(false);
    expect(await verifyPassword("OwnerNew!3456", owner.passwordHash)).toBe(true);
    expect(await verifyPassword("OwnerTemp!2345", owner.passwordHash)).toBe(false);

    // The rotation deletes the live session, so the owner must sign in again with
    // the new password before the admin console is reachable.
    const denied = await catchRedirect(() => requireAdmin("/admin"));
    expect(denied).toContain("/login");
    const oldLogin = await loginAction({}, ownerLoginForm(ownerEmail, "OwnerTemp!2345", "/admin"));
    expect(oldLogin.error).toBeTruthy();
    const freshLogin = await catchRedirect(() => loginAction({}, ownerLoginForm(ownerEmail, "OwnerNew!3456", "/admin")));
    expect(freshLogin).toContain("/login/2fa");
    const freshTotp = await catchRedirect(() => loginTwoFactorAction({}, ownerTwoFactorForm(totpCode("JBSWY3DPEHPK3PXP"), "/admin")));
    expect(freshTotp).toContain("/admin");
    expect((await requireAdmin("/admin")).email).toBe(ownerEmail);
  });
});
