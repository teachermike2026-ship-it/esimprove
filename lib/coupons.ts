import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { coupons, couponRedemptions } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export interface CouponValidationResult {
  ok: boolean;
  error?: string;
  coupon?: typeof coupons.$inferSelect;
  discountMinor?: number;
}

export async function validateCoupon(
  db: Database,
  input: { code: string; subtotalMinor: number },
): Promise<CouponValidationResult> {
  if (!input.code.trim()) return { ok: false, error: "Enter a promo code." };
  if (!Number.isSafeInteger(input.subtotalMinor) || input.subtotalMinor < 0) {
    return { ok: false, error: "Order total is invalid." };
  }
  const coupon = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, input.code.trim().toUpperCase()))
    .limit(1);
  const row = coupon[0];
  if (!row) return { ok: false, error: "Promo code was not found." };
  if (row.status !== "enabled") {
    return { ok: false, error: "This promo code is not active." };
  }
  const now = new Date();
  if (row.validFrom && row.validFrom > now) {
    return { ok: false, error: "This promo code is not valid yet." };
  }
  if (row.validTo && row.validTo < now) {
    return { ok: false, error: "This promo code has expired." };
  }
  if (row.maxRedemptions !== null && row.redeemedCount >= row.maxRedemptions) {
    return { ok: false, error: "This promo code has reached its redemption limit." };
  }

  let discountMinor = 0;
  if (row.kind === "percent") {
    discountMinor = Math.floor((input.subtotalMinor * row.value) / 10_000 + 0.5);
  } else if (row.kind === "fixed") {
    discountMinor = Math.min(row.value, input.subtotalMinor);
  } else {
    return { ok: false, error: "Promo code type is unsupported." };
  }
  discountMinor = Math.max(0, discountMinor);

  return { ok: true, coupon: row, discountMinor };
}

export async function redeemCoupon(
  db: Database,
  input: {
    couponId: string;
    orderId: string;
    userId?: string | null;
    code: string;
    discountMinor: number;
  },
): Promise<void> {
  const coupon = await db.select().from(coupons).where(eq(coupons.id, input.couponId)).limit(1);
  const row = coupon[0];
  if (!row) throw new Error("Coupon not found");
  if (row.redeemedCount >= (row.maxRedemptions ?? Number.MAX_SAFE_INTEGER)) {
    throw new Error("Promo code redemption limit reached");
  }
  await db.insert(couponRedemptions).values({
    id: newId("couponredeem"),
    couponId: input.couponId,
    orderId: input.orderId,
    userId: input.userId ?? null,
    code: input.code,
    discountMinor: input.discountMinor,
  });
  await db
    .update(coupons)
    .set({
      redeemedCount: row.redeemedCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, input.couponId));
}
