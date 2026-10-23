import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { EncryptedSecret } from "@/lib/db/schema";
import { activationKek, rateLimitHashSecret } from "@/lib/config";

const ALGORITHM = "aes-256-gcm";

function b64(value: Buffer): string {
  return value.toString("base64");
}

function fromB64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

function encryptWithKey(plaintext: string, key: Buffer): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: b64(ciphertext),
    iv: b64(iv),
    tag: b64(cipher.getAuthTag()),
  };
}

function decryptWithKey(
  payload: { ciphertext: string; iv: string; tag: string },
  key: Buffer,
): string {
  const decipher = createDecipheriv(ALGORITHM, key, fromB64(payload.iv));
  decipher.setAuthTag(fromB64(payload.tag));
  return Buffer.concat([
    decipher.update(fromB64(payload.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Envelope encryption: a random per-record DEK encrypts the secret; the DEK is
 * wrapped by the versioned KEK. The KEK is never stored in the database.
 */
export function encryptSecret(plaintext: string, key?: Buffer, version?: number): EncryptedSecret {
  const kek = key ?? activationKek().key;
  const keyVersion = version ?? activationKek().version;
  if (kek.length !== 32) throw new Error("Encryption key must be 32 bytes");

  const dek = randomBytes(32);
  const payload = encryptWithKey(plaintext, dek);
  const wrapped = encryptWithKey(b64(dek), kek);
  return {
    ciphertext: payload.ciphertext,
    iv: payload.iv,
    tag: payload.tag,
    wrappedDek: wrapped.ciphertext,
    dekIv: wrapped.iv,
    dekTag: wrapped.tag,
    keyVersion,
  };
}

export function decryptSecret(payload: EncryptedSecret, key?: Buffer): string {
  const kek = key ?? activationKek().key;
  const dek = fromB64(
    decryptWithKey(
      {
        ciphertext: payload.wrappedDek,
        iv: payload.dekIv,
        tag: payload.dekTag,
      },
      kek,
    ),
  );
  return decryptWithKey(
    {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      tag: payload.tag,
    },
    dek,
  );
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}

export function hmacHex(value: string | Buffer, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashIdentifier(value: string): string {
  return hmacHex(value, rateLimitHashSecret());
}
