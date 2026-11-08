import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { seedDemoData } from "@/lib/db/seed";
import { totpCode } from "@/lib/auth/totp";

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
    headers: async () => new Headers({ "user-agent": "vitest-auth-flow" }),
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

function loginForm(email: string, password: string, next = ""): FormData {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("next", next);
  return form;
}

describe("real login and administrator TOTP flow", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
    await runMigrations(handle.client, handle.dialect);
    await seedDemoData(handle.db, {
      adminEmail: "admin@demo.local",
      adminPassword: "DemoAdmin!2345",
      adminTotpSecret: "JBSWY3DPEHPK3PXP",
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

  it("requires the real TOTP code before promoting an administrator session", async () => {
    jar.token = null;
    const { loginAction, loginTwoFactorAction } = await import("@/lib/auth/actions");

    const loginRedirect = await catchRedirect(() =>
      loginAction({}, loginForm("admin@demo.local", "DemoAdmin!2345")),
    );
    expect(loginRedirect).toContain("/login/2fa");
    expect(jar.token).toBeTruthy();

    const pendingToken = jar.token;
    const { requireAdmin } = await import("@/lib/auth/guards");
    await expect(catchRedirect(() => requireAdmin("/admin"))).resolves.toContain("/login/2fa");

    const invalid = new FormData();
    invalid.set("code", "000000");
    const invalidResult = await loginTwoFactorAction({}, invalid);
    expect(invalidResult.error).toMatch(/invalid|expired/);
    expect(jar.token).toBe(pendingToken);

    const valid = new FormData();
    valid.set("code", totpCode("JBSWY3DPEHPK3PXP"));
    valid.set("next", "/admin/audit");
    const validRedirect = await catchRedirect(() => loginTwoFactorAction({}, valid));
    expect(validRedirect).toContain("/admin/audit");

    const admin = await requireAdmin("/admin/audit");
    expect(admin.email).toBe("admin@demo.local");
    expect(admin.role).toBe("admin");
  });

  it("rejects incorrect administrator passwords without creating a session", async () => {
    jar.token = null;
    const { loginAction } = await import("@/lib/auth/actions");
    const result = await loginAction(
      {},
      loginForm("admin@demo.local", "not-the-right-password"),
    );
    expect(result.error).toMatch(/incorrect/i);
    expect(jar.token).toBeNull();
  });
});
