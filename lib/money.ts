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

export function formatData(dataMb: number): string {
  if (!Number.isFinite(dataMb) || dataMb <= 0) return "—";
  if (dataMb >= 1000) {
    const gb = dataMb / 1000;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
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
