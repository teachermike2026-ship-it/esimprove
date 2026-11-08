import { describe, expect, it } from "vitest";
import { encryptSecret } from "@/lib/crypto";
import {
  decryptSupplierCredential,
  encryptSupplierCredential,
  getSupplierCredentialKey,
  supplierCredentialAad,
} from "@/lib/adapters/encryption";

describe("supplier credential encryption binding", () => {
  it("round-trips a credential only for its owning connection", () => {
    const encrypted = encryptSupplierCredential("supplier_conn_a", "super-secret-token");
    expect(encrypted.aadVersion).toBe(1);
    expect(decryptSupplierCredential("supplier_conn_a", encrypted)).toBe(
      "super-secret-token",
    );
    expect(() =>
      decryptSupplierCredential("supplier_conn_b", encrypted),
    ).toThrow();
  });

  it("rejects tampered ciphertext and authentication tags", () => {
    const encrypted = encryptSupplierCredential("supplier_conn_a", "secret-value");
    const tamperedCiphertext = {
      ...encrypted,
      ciphertext: Buffer.from("not-the-original-ciphertext").toString("base64"),
    };
    expect(() =>
      decryptSupplierCredential("supplier_conn_a", tamperedCiphertext),
    ).toThrow();

    const tamperedTag = {
      ...encrypted,
      tag: Buffer.alloc(16, 0).toString("base64"),
    };
    expect(() => decryptSupplierCredential("supplier_conn_a", tamperedTag)).toThrow();
  });

  it("uses a stable, non-secret AAD value", () => {
    expect(supplierCredentialAad("supplier_conn_a")).toBe(
      "supplier-credential:v1:supplier_conn_a",
    );
    expect(() => supplierCredentialAad("   ")).toThrow();
  });

  it("keeps legacy ciphertext readable and marks new records as bound", () => {
    const legacy = encryptSecret("legacy-secret", getSupplierCredentialKey());
    expect(legacy.aadVersion).toBeUndefined();
    expect(decryptSupplierCredential("any_connection", legacy)).toBe("legacy-secret");
  });
});
