const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  JPY: 0,
  KRW: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
};

export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}

export function assertSafeMinor(amount: number, label = "amount"): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`${label} must be a non-negative safe integer in minor units`);
  }
}

export function formatMoney(
  amountMinor: number,
  currency = "USD",
  locale = "en-US",
): string {
  assertSafeMinor(amountMinor, "amountMinor");
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amountMinor / 10 ** decimals);
}

/**
 * Converts a user-entered decimal amount (for example "12.50") into integer
 * minor units for the given currency. Rejects extra precision instead of
 * silently rounding a refund or catalogue cost.
 */
export function parseMoneyToMinor(value: string, currency = "USD"): number {
  const trimmed = value.trim();
  const match = /^(\d{1,12})(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) throw new Error("Enter a valid amount");
  const decimals = currencyDecimals(currency);
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    throw new Error(`Use at most ${decimals} decimal place${decimals === 1 ? "" : "s"}`);
  }
  const whole = Number(match[1]);
  const minor = Number((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  const amount = whole * 10 ** decimals + minor;
  if (!Number.isSafeInteger(amount)) throw new Error("Amount is too large");
  return amount;
}

/**
 * eSIM Access encodes "unlimited" packages as a very large total (999 GB).
 * Anything at or above this is shown as unlimited, never as a fake GB number.
 */
export const UNLIMITED_DATA_MB = 900 * 1024;

export function isUnlimitedData(dataMb: number): boolean {
  return Number.isFinite(dataMb) && dataMb >= UNLIMITED_DATA_MB;
}

/**
 * Data allowance label. Supplier volumes are binary (eSIM Access: 1 GB =
 * 1,073,741,824 bytes = 1,024 MB), so a "3GB" package (3,072 MB) shows as
 * "3 GB", matching the package name.
 */
export function formatData(dataMb: number): string {
  if (!Number.isFinite(dataMb) || dataMb <= 0) return "—";
  if (isUnlimitedData(dataMb)) return "Unlimited";
  if (dataMb >= 1024) {
    const gb = dataMb / 1024;
    return `${Number.isInteger(gb) ? gb : Number(gb.toFixed(1))} GB`;
  }
  return `${dataMb} MB`;
}

export function formatDate(value: Date | string | null | undefined, locale = "en-US"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateOnly(value: Date | string | null | undefined, locale = "en-US"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function sumMinor(values: number[]): number {
  return values.reduce((total, value) => {
    assertSafeMinor(value, "value");
    const next = total + value;
    if (!Number.isSafeInteger(next)) throw new Error("Money total exceeds safe integer range");
    return next;
  }, 0);
}
