import { randomBytes, randomInt } from "node:crypto";

/**
 * Precision-safe Binance-Peg USDT (18 decimals) amount helpers.
 *
 * Business order totals are USD minor units (cents). The asset is a USD-pegged
 * token, so the integration converts 1 USD cent to 10^16 base units (0.01 USDT).
 * It never uses floating point and it refuses non-USD orders rather than
 * inventing an unverified exchange rate.
 */

export const TOKEN_DECIMALS = 18;
export const TOKEN_SCALE = 10n ** BigInt(TOKEN_DECIMALS);
export const RAW_PER_CENT = TOKEN_SCALE / 100n;
/** Four decimal places of uniqueness = 10^14 base units. */
export const AMOUNT_SUFFIX_STEP = 10n ** 14n;
/**
 * At most 0.0099 USDT (less than one US cent) is added to make an amount
 * unique. The customer is told about this before ordering, so the payable
 * amount never exceeds the advertised price by a cent or more.
 */
export const MAX_AMOUNT_SUFFIX = 99;

export class CryptoAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoAmountError";
  }
}

export interface GeneratedPaymentAmount {
  amountRaw: bigint;
  amountRawString: string;
  amountUsdt: string;
  suffix: number;
}

function assertAmountMinor(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new CryptoAmountError("Order total must be a positive integer amount in minor units");
  }
}

/** 28.58 USD (2858 cents) -> 28.58 * 10^18 base units. */
export function baseAmountRaw(amountMinor: number, currency: string): bigint {
  assertAmountMinor(amountMinor);
  if (currency.trim().toUpperCase() !== "USD") {
    throw new CryptoAmountError(
      "Crypto checkout currently supports USD-priced orders only; no exchange rate is assumed",
    );
  }
  return BigInt(amountMinor) * RAW_PER_CENT;
}

/**
 * Add a cryptographically random 1-99 suffix in the 3rd-4th decimal places (max 0.0099 USDT).
 * A nonzero suffix keeps the payable amount different from the marketing
 * price. The database unique index on amount_raw provides the final,
 * concurrency-safe reservation.
 */
export function generatePaymentAmount(
  amountMinor: number,
  currency: string,
  randomSuffix: () => number = () => randomInt(1, MAX_AMOUNT_SUFFIX + 1),
): GeneratedPaymentAmount {
  const base = baseAmountRaw(amountMinor, currency);
  const suffix = randomSuffix();
  if (!Number.isSafeInteger(suffix) || suffix < 1 || suffix > MAX_AMOUNT_SUFFIX) {
    throw new CryptoAmountError(`Amount suffix must be an integer between 1 and ${MAX_AMOUNT_SUFFIX}`);
  }
  const amountRaw = base + BigInt(suffix) * AMOUNT_SUFFIX_STEP;
  return {
    amountRaw,
    amountRawString: amountRaw.toString(),
    amountUsdt: formatRawTokenAmount(amountRaw),
    suffix,
  };
}

/** Format base units as an exact decimal string with at least two decimals. */
export function formatRawTokenAmount(
  amountRaw: bigint,
  decimals = TOKEN_DECIMALS,
): string {
  if (amountRaw < 0n) throw new CryptoAmountError("Token amount cannot be negative");
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 78) {
    throw new CryptoAmountError("Token decimals are out of range");
  }
  const scale = 10n ** BigInt(decimals);
  const whole = amountRaw / scale;
  let fraction = (amountRaw % scale).toString().padStart(decimals, "0");
  fraction = fraction.replace(/0+$/, "");
  while (fraction.length < 2) fraction += "0";
  return `${whole.toString()}.${fraction}`;
}

/** Strict decimal parser used for tests and manual checks. No exponent notation. */
export function parseTokenAmount(value: string, decimals = TOKEN_DECIMALS): bigint {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
    throw new CryptoAmountError("Amount must be a plain decimal number");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new CryptoAmountError(`Amount has more than ${decimals} decimal places`);
  }
  const scale = 10n ** BigInt(decimals);
  const padded = fraction.padEnd(decimals, "0");
  return BigInt(whole) * scale + BigInt(padded || "0");
}

/** Parse a NUMERIC(78,0) value returned by the database. */
export function parseRawAmountFromDb(value: string | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (!/^\d+$/.test(value.trim())) {
    throw new CryptoAmountError("Stored token amount is not a valid integer");
  }
  return BigInt(value.trim());
}

/** Human-readable order reference, e.g. ESIM-7F3A9C21. */
export function generateCryptoPaymentReference(): string {
  return `ESIM-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Case-insensitive EVM address comparison without checksum assumptions. */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}
