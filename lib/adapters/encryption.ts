import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { activationKek, demoMode, isProduction } from "@/lib/config";
import type { EncryptedSecret } from "@/lib/db/schema";

const FALLBACK_FLAG = "SUPPLIER_CREDENTIAL_ALLOW_ACTIVATION_KEK_FALLBACK";

function fallbackExplicitlyAllowed(): boolean {
  const value = process.env[FALLBACK_FLAG];
  if (value !== undefined && value !== "") {
    return value === "true" || value === "1";
  }
  // Local/demo installs already have an activation KEK and no supplier key.
  // Deployed environments must opt in explicitly instead of inheriting it.
  return !isProduction && demoMode;
}

export function getSupplierCredentialKey(): Buffer {
  const dedicated = process.env.SUPPLIER_CREDENTIAL_KEK;
  if (dedicated) {
    const buf = Buffer.from(dedicated, "base64");
    if (buf.length !== 32) {
      throw new Error("SUPPLIER_CREDENTIAL_KEK must be a base64-encoded 32-byte key");
    }
    return buf;
  }
  if (fallbackExplicitlyAllowed()) {
    // The activation KEK is already verified by lib/config assertions.
    return activationKek().key;
  }
  throw new Error(
    "SUPPLIER_CREDENTIAL_KEK is required; activation KEK fallback is disabled in this environment",
  );
}

/**
 * Binds a supplier credential to the connection row that owns it. Without the
 * connection ID the ciphertext cannot be decrypted, so copying a credential
 * blob onto another supplier record fails authentication.
 */
export function supplierCredentialAad(connectionId: string): string {
  const normalized = connectionId.trim();
  if (!normalized) throw new Error("Supplier connection ID is required for credential binding");
  return `supplier-credential:v1:${normalized}`;
}

export function encryptSupplierCredential(
  connectionId: string,
  plaintext: string,
  version?: number,
): EncryptedSecret {
  const key = getSupplierCredentialKey();
  return encryptSecret(
    plaintext,
    key,
    version ?? 1,
    supplierCredentialAad(connectionId),
  );
}

export function decryptSupplierCredential(
  connectionId: string,
  payload: EncryptedSecret,
): string {
  const key = getSupplierCredentialKey();
  if (payload.aadVersion === 1) {
    return decryptSecret(payload, key, supplierCredentialAad(connectionId));
  }
  // Legacy records created before AAD binding remain readable. New records
  // always set aadVersion, and cross-record substitution is rejected for them.
  return decryptSecret(payload, key);
}
