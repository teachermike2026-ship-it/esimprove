import { cookies } from "next/headers";
import { CART_COOKIE } from "@/lib/cart-cookie";

export async function readCartToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE)?.value ?? null;
}

export async function clearCartCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
