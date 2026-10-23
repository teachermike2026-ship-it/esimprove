import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { cartItems, carts, destinations, plans } from "@/lib/db/schema";
import { calculateTotals } from "@/lib/pricing";
import { newId } from "@/lib/ids";

export interface CartLine {
  id: string;
  planId: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  planName: string;
  planSlug: string;
  destinationName: string;
  destinationSlug: string;
  dataMb: number;
  validityDays: number;
  taxBps: number;
  status: string;
  isDemo: boolean;
}

export interface CartView {
  cartId: string;
  token: string;
  lines: CartLine[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  count: number;
}

export async function getCartByToken(db: Database, token: string) {
  const rows = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
  return rows[0] ?? null;
}

export async function getCartView(db: Database, token: string): Promise<CartView | null> {
  const cart = await getCartByToken(db, token);
  if (!cart) return null;
  const rows = await db
    .select({
      id: cartItems.id,
      planId: cartItems.planId,
      quantity: cartItems.quantity,
      unitPriceMinor: cartItems.unitPriceMinor,
      currency: cartItems.currency,
      planName: plans.name,
      planSlug: plans.slug,
      destinationName: destinations.name,
      destinationSlug: destinations.slug,
      dataMb: plans.dataMb,
      validityDays: plans.validityDays,
      taxBps: plans.taxBps,
      status: plans.status,
      isDemo: plans.isDemo,
    })
    .from(cartItems)
    .innerJoin(plans, eq(cartItems.planId, plans.id))
    .innerJoin(destinations, eq(plans.destinationId, destinations.id))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(cartItems.createdAt);

  const lines: CartLine[] = rows;
  const totals = calculateTotals(
    lines.map((line) => ({
      unitPriceMinor: line.unitPriceMinor,
      quantity: line.quantity,
    })),
    lines[0]?.taxBps ?? 0,
  );
  return {
    cartId: cart.id,
    token: cart.token,
    lines,
    subtotalMinor: totals.subtotalMinor,
    taxMinor: totals.taxMinor,
    totalMinor: totals.totalMinor,
    currency: lines[0]?.currency ?? "USD",
    count: lines.reduce((total, line) => total + line.quantity, 0),
  };
}

export async function getOrCreateCart(
  db: Database,
  token?: string,
): Promise<{ cartId: string; token: string; created: boolean }> {
  if (token) {
    const existing = await getCartByToken(db, token);
    if (existing) return { cartId: existing.id, token: existing.token, created: false };
  }
  const newToken = token && token.length >= 20 ? token : newId("carttoken");
  const id = newId("cart");
  await db.insert(carts).values({ id, token: newToken });
  return { cartId: id, token: newToken, created: true };
}

export async function addCartItem(
  db: Database,
  cartId: string,
  planId: string,
  quantity: number,
): Promise<void> {
  const planRows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.status, "published")))
    .limit(1);
  const plan = planRows[0];
  if (!plan) throw new Error("That demo plan is not available.");

  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.planId, planId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(cartItems)
      .set({ quantity: Math.min(5, existing[0].quantity + quantity) })
      .where(eq(cartItems.id, existing[0].id));
    return;
  }

  await db.insert(cartItems).values({
    id: newId("cartitem"),
    cartId,
    planId,
    quantity: Math.min(5, Math.max(1, quantity)),
    unitPriceMinor: plan.priceMinor,
    currency: plan.currency,
  });
}

export async function updateCartItem(
  db: Database,
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await removeCartItem(db, cartId, itemId);
    return;
  }
  await db
    .update(cartItems)
    .set({ quantity: Math.min(5, quantity) })
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
}

export async function removeCartItem(
  db: Database,
  cartId: string,
  itemId: string,
): Promise<void> {
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
}

export async function clearCart(db: Database, cartId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}
