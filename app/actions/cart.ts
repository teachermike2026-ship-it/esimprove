"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import {
  addCartItem,
  getCartByToken,
  getOrCreateCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/cart";
import { cartItemSchema, formString } from "@/lib/validation";
import { CART_COOKIE } from "@/lib/cart-cookie";

async function readCartToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE)?.value ?? null;
}

async function writeCartToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function addToCartAction(formData: FormData): Promise<void> {
  const parsed = cartItemSchema.safeParse({
    planId: formString(formData, "planId"),
    quantity: formString(formData, "quantity") || "1",
  });
  if (!parsed.success) redirect("/plans");

  const db = await getDb();
  const existingToken = await readCartToken();
  const cart = await getOrCreateCart(db, existingToken ?? undefined);
  if (cart.created) await writeCartToken(cart.token);
  await addCartItem(db, cart.cartId, parsed.data.planId, parsed.data.quantity);
  revalidatePath("/cart");
  revalidatePath("/checkout");
  redirect(formString(formData, "checkout") === "1" ? "/checkout" : "/cart");
}

export async function updateCartAction(formData: FormData): Promise<void> {
  const token = await readCartToken();
  if (!token) redirect("/cart");
  const db = await getDb();
  const cart = await getCartByToken(db, token);
  if (!cart) redirect("/cart");
  const itemId = formString(formData, "itemId");
  const quantity = Number(formString(formData, "quantity") || "0");
  if (!itemId || !Number.isInteger(quantity)) redirect("/cart");
  await updateCartItem(db, cart.id, itemId, quantity);
  revalidatePath("/cart");
  redirect("/cart");
}

export async function removeCartAction(formData: FormData): Promise<void> {
  const token = await readCartToken();
  if (!token) redirect("/cart");
  const db = await getDb();
  const cart = await getCartByToken(db, token);
  if (!cart) redirect("/cart");
  const itemId = formString(formData, "itemId");
  if (itemId) await removeCartItem(db, cart.id, itemId);
  revalidatePath("/cart");
  redirect("/cart");
}
