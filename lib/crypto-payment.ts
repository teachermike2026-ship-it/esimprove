/**
 * Public configuration for the local USDT (BEP-20) checkout preview.
 *
 * This address is public receiving information supplied for the preview. It is
 * not a secret. Never place private keys, seed phrases, or wallet credentials
 * in this file or anywhere in the application.
 *
 * The address, network compatibility, and token contract are shown for UI
 * preview only. Ownership and the official contract must be independently
 * verified before this configuration is used to accept real customer funds.
 */
export const USDT_BEP20_PAYMENT = {
  asset: "USDT",
  network: "BNB Smart Chain",
  standard: "BEP-20",
  receivingAddress: "0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E",
  tokenContract: "0x55d398326f99059fF775485246999027B3197955",
  tokenDecimals: 18,
} as const;

/**
 * Preview-only display basis. The demo order is denominated in USD, so the
 * interface shows the USD total 1:1 as USDT to make the layout legible.
 *
 * This is NOT a live exchange rate, is not a market quote, and must never be
 * used to accept funds. A live implementation must obtain an authoritative
 * server-side conversion basis and enforce the amount server-side.
 */
export const PREVIEW_USDT_PER_USD = 1;

export function formatPreviewUsdtAmount(
  amountMinor: number,
  currency: string,
  locale = "en",
): string {
  if (currency.toUpperCase() !== "USD") {
    throw new Error("The USDT preview amount requires a USD order total");
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("amountMinor must be a non-negative safe integer");
  }

  const usdtMinor = Math.round(amountMinor * PREVIEW_USDT_PER_USD);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: "latn",
    useGrouping: false,
  }).format(usdtMinor / 100);
}
