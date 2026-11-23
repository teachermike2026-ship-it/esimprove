import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { redactSensitiveEmailText } from "@/lib/integrations/email/redact";
import { MockEmailTransport } from "@/lib/integrations/email/mock";
import { randomToken } from "@/lib/crypto";
import type { DatabaseHandle } from "@/lib/db/client";

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
    headers: async () => new Headers({ "user-agent": "vitest-redaction" }),
  };
});

describe("email redaction", () => {
  it("redacts actionable query parameters", () => {
    const input =
      "Open https://example.test/reset-password?token=abc123def456ghi789&via=demo to continue";
    const output = redactSensitiveEmailText(input);
    expect(output).not.toContain("abc123def456ghi789");
    expect(output).toContain("token=[redacted]");
  });

  it("redacts verification, reset, and access token parameters", () => {
    for (const param of ["token", "code", "key", "secret", "signature", "access_token", "reset_token"]) {
      const output = redactSensitiveEmailText(`https://example.test/x?${param}=topsecretvalue12345`);
      expect(output).not.toContain("topsecretvalue12345");
      expect(output).toContain(`${param}=[redacted]`);
    }
  });

  it("redacts standalone high-entropy tokens like randomToken(32)", () => {
    const token = randomToken(32);
    expect(token).toHaveLength(43);
    const output = redactSensitiveEmailText(`Reset your password using ${token} today`);
    expect(output).not.toContain(token);
    expect(output).toContain("[redacted]");
  });

  it("keeps ordinary content intact", () => {
    const input = "Order ES-260111-A1B2C3 for you@example.com is ready. Amount: 42.50 USD.";
    expect(redactSensitiveEmailText(input)).toBe(input);
  });

  it("mock transport never prints the raw token", async () => {
    const token = randomToken(32);
    const logs: string[] = [];
    const original = console.info;
    console.info = (message?: unknown) => {
      logs.push(String(message));
    };
    try {
      const transport = new MockEmailTransport();
      await transport.send({
        to: "you@example.com",
        template: "auth.password_reset",
        subject: "Reset your demo password",
        text: `Reset: https://example.test/reset-password?token=${token}`,
      });
    } finally {
      console.info = original;
    }
    const joined = logs.join("\n");
    expect(joined).not.toContain(token);
    expect(joined).toContain("[redacted]");
  });
});

describe("login rate limiting", () => {
  let handle: DatabaseHandle;

  beforeAll(async () => {
    const { createDatabase } = await import("@/lib/db/client");
    const { runMigrations } = await import("@/lib/db/migrate");
    const { seedDemoData } = await import("@/lib/db/seed");
    handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
    await runMigrations(handle.client, handle.dialect);
    await seedDemoData(handle.db, {
      adminEmail: "admin@demo.local",
      adminPassword: "DemoAdmin!2345",
      adminTotpSecret: "JBSWY3DPEHPK3PXP",
    });
    (
      globalThis as typeof globalThis & { __esimproveDbPromise?: Promise<typeof handle> }
    ).__esimproveDbPromise = Promise.resolve(handle);
  });

  afterAll(async () => {
    const globalWithDb = globalThis as typeof globalThis & {
      __esimproveDbPromise?: Promise<typeof handle>;
    };
    globalWithDb.__esimproveDbPromise = undefined;
    await handle.close();
  });

  function loginForm(email: string, password: string): FormData {
    const form = new FormData();
    form.set("email", email);
    form.set("password", password);
    form.set("next", "");
    return form;
  }

  it("limits by account independently of the source address", async () => {
    jar.token = null;
    const { loginAction } = await import("@/lib/auth/actions");

    // Ten failed attempts for the same account from the shared test IP.
    for (let i = 0; i < 10; i += 1) {
      const result = await loginAction(
        {},
        loginForm("admin@demo.local", "not-the-right-password"),
      );
      expect(result.error).toMatch(/incorrect/i);
    }

    // The account counter is now exhausted. The error must change to the
    // rate-limit message instead of "incorrect password".
    const limited = await loginAction(
      {},
      loginForm("admin@demo.local", "not-the-right-password"),
    );
    expect(limited.error).toMatch(/too many/i);

    // A different account from the same IP is not blocked by the first
    // account's lockout (the account counter is per account), so it reaches
    // the credential check instead of the limiter.
    const other = await loginAction(
      {},
      loginForm("not-the-same-account@example.com", "whatever-password"),
    );
    expect(other.error).toMatch(/incorrect/i);
  }, 60_000);
});
