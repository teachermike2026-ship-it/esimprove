import { assertSafeMinor, sumMinor } from "@/lib/money";

export interface PricedLine {
  unitPriceMinor: number;
  quantity: number;
}

export interface OrderTotals {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

const BPS_DENOMINATOR = 10_000n;

function roundHalfUp(numerator: bigint, denominator: bigint): number {
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Priced amount exceeds safe integer range");
  }
  return Number(rounded);
}

/**
 * Applies a basis-point markup to an integer minor-unit cost.
 * 2500 bps = 25%. Rounding is half-up at the minor unit.
 */
export function calculateSalePrice(
  costMinor: number,
  markupBps: number,
  fixedFeeMinor = 0,
): number {
  assertSafeMinor(costMinor, "costMinor");
  assertSafeMinor(fixedFeeMinor, "fixedFeeMinor");
  if (!Number.isInteger(markupBps) || markupBps < 0 || markupBps > 100_000) {
    throw new Error("markupBps must be an integer between 0 and 100000");
  }
  const numerator =
    BigInt(costMinor) * (BPS_DENOMINATOR + BigInt(markupBps)) +
    BigInt(fixedFeeMinor) * BPS_DENOMINATOR;
  return roundHalfUp(numerator, BPS_DENOMINATOR);
}

export function calculateTax(subtotalMinor: number, taxBps: number): number {
  assertSafeMinor(subtotalMinor, "subtotalMinor");
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 100_000) {
    throw new Error("taxBps must be an integer between 0 and 100000");
  }
  return roundHalfUp(BigInt(subtotalMinor) * BigInt(taxBps), BPS_DENOMINATOR);
}

export function calculateTotals(lines: PricedLine[], taxBps = 0): OrderTotals {
  const subtotalMinor = sumMinor(
    lines.map((line) => {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new Error("quantity must be a positive integer");
      }
      assertSafeMinor(line.unitPriceMinor, "unitPriceMinor");
      return line.unitPriceMinor * line.quantity;
    }),
  );
  const taxMinor = calculateTax(subtotalMinor, taxBps);
  return {
    subtotalMinor,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
  };
}

export function marginBps(saleMinor: number, costMinor: number): number {
  if (saleMinor <= 0) return 0;
  return Math.round(((saleMinor - costMinor) / saleMinor) * 10_000);
}
