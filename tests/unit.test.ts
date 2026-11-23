import { describe, expect, it } from "vitest";
import {
  assertSafeMinor,
  currencyDecimals,
  formatData,
  formatDate,
  formatDateOnly,
  formatMoney,
  sumMinor,
} from "@/lib/money";
import {
  calculateSalePrice,
  calculateTax,
  calculateTotals,
  marginBps,
} from "@/lib/pricing";
import {
  assertFulfillmentTransition,
  assertOrderTransition,
  assertPaymentTransition,
  canTransitionFulfillment,
  canTransitionOrder,
  canTransitionPayment,
  deriveOrderStatus,
} from "@/lib/state";
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  hmacHex,
  safeEqual,
} from "@/lib/crypto";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUrl,
  totpCode,
  verifyTotp,
} from "@/lib/auth/totp";
import { safeNextPath } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("money", () => {
  it("uses the correct minor-unit precision for known currencies", () => {
    expect(currencyDecimals("USD")).toBe(2);
    expect(currencyDecimals("jpy")).toBe(0);
    expect(currencyDecimals("KWD")).toBe(3);
    expect(currencyDecimals("ZZZ")).toBe(2);
  });

  it("rejects unsafe or negative minor-unit values", () => {
    expect(() => assertSafeMinor(-1)).toThrow();
    expect(() => assertSafeMinor(1.5)).toThrow();
    expect(() => assertSafeMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => assertSafeMinor(0)).not.toThrow();
  });

  it("formats money without floating-point storage", () => {
    expect(formatMoney(1234, "USD")).toContain("12.34");
    expect(formatMoney(1234, "JPY")).toContain("1,234");
    expect(formatMoney(1234, "JPY")).not.toContain(".");
    expect(formatMoney(1234567, "KWD")).toContain("1,234.567");
  });

  it("formats data and dates defensively", () => {
    expect(formatData(500)).toBe("500 MB");
    expect(formatData(1000)).toBe("1 GB");
    expect(formatData(1500)).toBe("1.5 GB");
    expect(formatData(0)).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDateOnly("not-a-date")).toBe("—");
    expect(formatDate("2026-10-23T12:00:00.000Z")).not.toBe("—");
  });

  it("sums safely", () => {
    expect(sumMinor([1, 2, 3])).toBe(6);
    expect(() => sumMinor([1, -1])).toThrow();
  });
});

describe("pricing", () => {
  it("applies basis-point markup with half-up rounding", () => {
    expect(calculateSalePrice(1000, 2500)).toBe(1250);
    expect(calculateSalePrice(101, 500)).toBe(106);
    expect(calculateSalePrice(1000, 0, 99)).toBe(1099);
    expect(calculateSalePrice(1, 5000)).toBe(2);
  });

  it("rejects invalid markup and tax rates", () => {
    expect(() => calculateSalePrice(1000, -1)).toThrow();
    expect(() => calculateSalePrice(1000, 100_001)).toThrow();
    expect(() => calculateSalePrice(1000, 1.5)).toThrow();
    expect(() => calculateTax(1000, -1)).toThrow();
    expect(() => calculateTax(1000, 100_001)).toThrow();
  });

  it("calculates tax and order totals in minor units", () => {
    expect(calculateTax(1000, 825)).toBe(83);
    expect(calculateTax(2500, 825)).toBe(206);
    expect(
      calculateTotals(
        [
          { unitPriceMinor: 1000, quantity: 2 },
          { unitPriceMinor: 500, quantity: 1 },
        ],
        825,
      ),
    ).toEqual({ subtotalMinor: 2500, taxMinor: 206, totalMinor: 2706 });
  });

  it("rejects non-positive quantities", () => {
    expect(() => calculateTotals([{ unitPriceMinor: 100, quantity: 0 }])).toThrow();
    expect(() => calculateTotals([{ unitPriceMinor: 100, quantity: 1.5 }])).toThrow();
  });

  it("reports margin in basis points", () => {
    expect(marginBps(1250, 1000)).toBe(2000);
    expect(marginBps(0, 1000)).toBe(0);
  });
});

describe("state machine", () => {
  it("allows only declared payment transitions", () => {
    expect(canTransitionPayment("pending", "paid")).toBe(true);
    expect(canTransitionPayment("pending", "failed")).toBe(true);
    expect(canTransitionPayment("paid", "refunded")).toBe(true);
    expect(canTransitionPayment("paid", "failed")).toBe(false);
    expect(canTransitionPayment("failed", "paid")).toBe(false);
    expect(() => assertPaymentTransition("paid", "pending")).toThrow();
  });

  it("allows only declared fulfillment transitions", () => {
    expect(canTransitionFulfillment("not_started", "queued")).toBe(true);
    expect(canTransitionFulfillment("queued", "provisioning")).toBe(true);
    expect(canTransitionFulfillment("provisioning", "ready")).toBe(true);
    expect(canTransitionFulfillment("delivered", "queued")).toBe(false);
    expect(() => assertFulfillmentTransition("cancelled", "queued")).toThrow();
  });

  it("allows only declared order transitions", () => {
    expect(canTransitionOrder("pending_payment", "processing")).toBe(true);
    expect(canTransitionOrder("processing", "delivered")).toBe(true);
    expect(canTransitionOrder("delivered", "processing")).toBe(false);
    expect(() => assertOrderTransition("cancelled", "processing")).toThrow();
  });

  it("derives order status from payment and fulfillment", () => {
    expect(deriveOrderStatus("pending", "not_started")).toBe("pending_payment");
    expect(deriveOrderStatus("paid", "queued")).toBe("processing");
    expect(deriveOrderStatus("paid", "delivered")).toBe("delivered");
    expect(deriveOrderStatus("paid", "failed")).toBe("failed");
    expect(deriveOrderStatus("failed", "not_started")).toBe("failed");
    expect(deriveOrderStatus("refunded", "delivered")).toBe("cancelled");
    expect(deriveOrderStatus("paid", "cancelled")).toBe("cancelled");
  });
});

describe("cryptography", () => {
  it("round-trips envelope-encrypted activation data", () => {
    const plaintext = "LPA:1$rsp.demo.invalid$DEMO-TEST";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted.ciphertext).not.toContain("LPA:");
    expect(encrypted.keyVersion).toBe(1);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("rejects tampered ciphertext and the wrong key", () => {
    const encrypted = encryptSecret("secret-value");
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from("tampered-ciphertext").toString("base64"),
    };
    expect(() => decryptSecret(tampered)).toThrow();
    expect(() => decryptSecret(encrypted, Buffer.alloc(32, 9))).toThrow();
  });

  it("hashes tokens and compares signatures safely", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hmacHex("payload", "secret")).toBe(hmacHex("payload", "secret"));
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "different")).toBe(false);
  });
});

describe("TOTP", () => {
  it("round-trips base32", () => {
    expect(base32Encode(Buffer.from("hello"))).toBe("NBSWY3DP");
    expect(base32Decode("NBSWY3DP").toString()).toBe("hello");
    expect(base32Decode("NBSW Y3DP").toString()).toBe("hello");
    expect(() => base32Decode("!!!")).toThrow();
  });

  it("generates and verifies a six-digit code", () => {
    const secret = generateTotpSecret();
    const now = Date.UTC(2026, 9, 23, 12, 0, 0);
    const code = totpCode(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, 1, now)).toBe(true);
    expect(verifyTotp(secret, code, 0, now + 30_000)).toBe(false);
    expect(verifyTotp(secret, "000000", 0, now)).toBe(false);
    expect(verifyTotp(secret, "12345", 1, now)).toBe(false);
  });

  it("builds an otpauth URL without leaking the label", () => {
    const url = otpauthUrl("JBSWY3DPEHPK3PXP", "demo@example.com");
    expect(url).toContain("otpauth://totp/");
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(url).toContain("issuer=Esimprove");
  });
});

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const stored = await hashPassword("DemoPassword!2345");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("DemoPassword!2345", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
    expect(await verifyPassword("DemoPassword!2345", "garbage")).toBe(false);
  });

  it("rejects short passwords", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });
});

describe("safe redirect paths", () => {
  it("accepts only same-origin absolute paths", () => {
    expect(safeNextPath("/portal", "/")).toBe("/portal");
    expect(safeNextPath("/admin/orders?x=1", "/")).toBe("/admin/orders?x=1");
    expect(safeNextPath("https://evil.example", "/")).toBe("/");
    expect(safeNextPath("//evil.example", "/")).toBe("/");
    expect(safeNextPath("/\\evil.example", "/")).toBe("/");
    expect(safeNextPath("/\u0000evil", "/")).toBe("/");
    expect(safeNextPath("", "/")).toBe("/");
  });
});
