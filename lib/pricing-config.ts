/**
 * Central pricing for supplier-backed eSIM packages: TARGET NET PROFIT.
 *
 * Every eSIM must earn at least ESIMPROVE_TARGET_NET_PROFIT_USD (default
 * $3.00) after the supplier cost AND the payment processing fee:
 *
 *   price = ceil( (cost + targetProfit + feeFixed) / (1 - feePercent/100) )
 *   net   = price - cost - (price × feePercent/100 + feeFixed)  >=  targetProfit
 *
 * Fee assumptions (documented by Whop, https://docs.whop.com/fees.md and
 * /payments-and-billing/fees/regional-fees.md, read 2026-11-25):
 *   card base "2.7% + $0.30" (US, CA, EU, UK, AU) + "1.5% for international
 *   cards". Default = 4.2% + $0.30, i.e. the international-card case, because
 *   eSIM buyers are typically travelling. Domestic cards therefore net a
 *   little more than the target.
 *
 * NOT included (flagged, account-specific or not per-eSIM; see
 * pricingAssumptions()): regional rates above the base (e.g. Brazil 8% +
 * $0.30), negotiated rates, +1% Whop currency conversion, optional
 * orchestration/billing/tax add-ons, 3DS/Radar per-transaction fees,
 * dispute fees, payout fees (charged per payout, not per sale).
 *
 * Crypto (USDT BEP-20) has no processor fee for ESIMPROVE (the customer pays
 * network gas), so crypto sales net slightly more than the target.
 *
 * The price is ALWAYS recomputed from the stored supplier cost, so repeated
 * synchronization can never compound a margin.
 */

export const DEFAULT_TARGET_NET_PROFIT_MINOR = 300; // $3.00
export const DEFAULT_CARD_FEE_PERCENT = 4.2; // 2.7% domestic + 1.5% international (Whop docs)
export const DEFAULT_CARD_FEE_FIXED_MINOR = 30; // $0.30 (Whop docs)

export interface PricingPolicy {
  targetNetProfitMinor: number;
  /** Fee percentage in basis points (4.2% -> 420). */
  feeBps: number;
  feeFixedMinor: number;
}

function parseUsdMinor(raw: string, name: string): number {
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) throw new Error(`${name} must be a USD amount such as 3.00`);
  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

function parsePercentBps(raw: string, name: string): number {
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(raw)) throw new Error(`${name} must be a percentage such as 4.2`);
  const bps = Math.round(Number(raw) * 100);
  if (bps >= 5000) throw new Error(`${name} must be below 50`);
  return bps;
}

export function pricingPolicy(env: NodeJS.ProcessEnv = process.env): PricingPolicy {
  const profit = (env.ESIMPROVE_TARGET_NET_PROFIT_USD ?? "").trim();
  const pct = (env.ESIMPROVE_CARD_FEE_PERCENT ?? "").trim();
  const fixed = (env.ESIMPROVE_CARD_FEE_FIXED_USD ?? "").trim();
  return {
    targetNetProfitMinor: profit
      ? parseUsdMinor(profit, "ESIMPROVE_TARGET_NET_PROFIT_USD")
      : DEFAULT_TARGET_NET_PROFIT_MINOR,
    feeBps: pct
      ? parsePercentBps(pct, "ESIMPROVE_CARD_FEE_PERCENT")
      : Math.round(DEFAULT_CARD_FEE_PERCENT * 100),
    feeFixedMinor: fixed ? parseUsdMinor(fixed, "ESIMPROVE_CARD_FEE_FIXED_USD") : DEFAULT_CARD_FEE_FIXED_MINOR,
  };
}

/** Problems with the pricing environment, for production configuration checks. */
export function pricingConfigurationProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  try {
    pricingPolicy(env);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

/** Selling price (minor units) that guarantees the target net profit. Rounds UP. */
export function sellingPriceFromCost(costMinor: number, policy: PricingPolicy = pricingPolicy()): number {
  if (!Number.isSafeInteger(costMinor) || costMinor <= 0) {
    throw new Error("costMinor must be a positive integer in minor units");
  }
  const numerator = BigInt(costMinor + policy.targetNetProfitMinor + policy.feeFixedMinor) * 10_000n;
  const denominator = BigInt(10_000 - policy.feeBps);
  const price = (numerator + denominator - 1n) / denominator; // ceil
  if (price > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Price exceeds safe integer range");
  return Number(price);
}

/** Net profit (minor units, may be fractional cents) for a card sale at `priceMinor`. */
export function netProfitMinor(priceMinor: number, costMinor: number, policy: PricingPolicy = pricingPolicy()): number {
  const fee = (priceMinor * policy.feeBps) / 10_000 + policy.feeFixedMinor;
  return priceMinor - costMinor - fee;
}

/** Effective markup over cost in basis points (informational; stored on plans). */
export function effectiveMarkupBps(priceMinor: number, costMinor: number): number {
  return Math.round(((priceMinor - costMinor) / costMinor) * 10_000);
}

/** Fees deliberately not built into prices; shown in reports and docs. */
export function pricingAssumptions(policy: PricingPolicy = pricingPolicy()) {
  return {
    targetNetProfitUsd: policy.targetNetProfitMinor / 100,
    cardFeeIncluded: `${policy.feeBps / 100}% + $${(policy.feeFixedMinor / 100).toFixed(2)} per card payment`,
    notIncluded: [
      "Regional card rates above the base (e.g. 2.9%/4.9%/8% + $0.30 in some Latin American countries)",
      "Negotiated or account-specific Whop rates",
      "Whop currency conversion (+1%) if adaptive pricing or conversion applies",
      "Optional Whop add-ons when enabled (orchestration 0.8%, billing 0.5%, tax 0.5%/2%)",
      "3DS ($0.03) / Radar ($0.07) per-transaction fees if enabled",
      "Dispute fees ($15) and payout/withdrawal fees (per payout, not per eSIM)",
    ],
  };
}
