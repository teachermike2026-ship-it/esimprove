/**
 * Guest order access without an account.
 *
 * A guest order is opened only with its secret access token (32 random bytes,
 * stored hashed in order_access_tokens). The order number alone never grants
 * access. To let guests come back without registering, this device keeps an
 * HTTP-only cookie listing the guest's own orders and their access tokens; the
 * browser's scripts cannot read it, and every entry is re-verified against the
 * database before anything is shown.
 */
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/config";

export const GUEST_ORDERS_COOKIE = "esimprove_guest_orders";
const MAX_GUEST_ORDERS = 20;
const COOKIE_DAYS = 365;

export interface GuestOrderEntry {
  orderNumber: string;
  token: string;
}

const ORDER_NUMBER = /^[A-Z0-9-]{6,40}$/;
const TOKEN = /^[A-Za-z0-9_-]{20,200}$/;

export function isPlausibleOrderNumber(value: string): boolean {
  return ORDER_NUMBER.test(value);
}

export function isPlausibleAccessToken(value: string): boolean {
  return TOKEN.test(value);
}

/**
 * Reads an order link (…/orders/ES-…?token=…) or an order number plus the
 * access code. The order number alone is never enough.
 */
export function parseOrderAccessInput(
  linkOrCode: string,
  orderNumberInput: string,
): { orderNumber: string; token: string } | null {
  const raw = linkOrCode.trim();
  let orderNumber = orderNumberInput.trim().toUpperCase();
  let token = raw;
  if (/token=/.test(raw)) {
    try {
      const url = new URL(raw, "https://example.invalid");
      token = url.searchParams.get("token") ?? "";
      const match = /\/(?:orders|checkout\/success)\/?([A-Za-z0-9-]*)/.exec(url.pathname);
      const fromPath = match?.[1] || url.searchParams.get("order") || "";
      if (fromPath) orderNumber = fromPath.toUpperCase();
    } catch {
      return null;
    }
  }
  if (!isPlausibleOrderNumber(orderNumber) || !isPlausibleAccessToken(token)) return null;
  return { orderNumber, token };
}

/** Parse the cookie value; anything malformed is ignored, never trusted. */
export function parseGuestOrders(raw: string | undefined | null): GuestOrderEntry[] {
  if (!raw) return [];
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(decoded)) return [];
    const entries: GuestOrderEntry[] = [];
    for (const item of decoded) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [orderNumber, token] = item as unknown[];
      if (typeof orderNumber !== "string" || typeof token !== "string") continue;
      if (!isPlausibleOrderNumber(orderNumber) || !isPlausibleAccessToken(token)) continue;
      entries.push({ orderNumber, token });
    }
    return entries.slice(0, MAX_GUEST_ORDERS);
  } catch {
    return [];
  }
}

export function serializeGuestOrders(entries: GuestOrderEntry[]): string {
  const unique: GuestOrderEntry[] = [];
  for (const entry of entries) {
    if (!unique.some((existing) => existing.orderNumber === entry.orderNumber)) unique.push(entry);
  }
  return Buffer.from(
    JSON.stringify(unique.slice(0, MAX_GUEST_ORDERS).map((entry) => [entry.orderNumber, entry.token])),
    "utf8",
  ).toString("base64url");
}

/** Newest first; an order already on the list gets its newest token. */
export function addGuestOrder(entries: GuestOrderEntry[], entry: GuestOrderEntry): GuestOrderEntry[] {
  return [entry, ...entries.filter((existing) => existing.orderNumber !== entry.orderNumber)].slice(
    0,
    MAX_GUEST_ORDERS,
  );
}

export async function readGuestOrders(): Promise<GuestOrderEntry[]> {
  const store = await cookies();
  return parseGuestOrders(store.get(GUEST_ORDERS_COOKIE)?.value);
}

/** Only callable from a Server Action or Route Handler. */
export async function rememberGuestOrder(entry: GuestOrderEntry): Promise<void> {
  const store = await cookies();
  const next = addGuestOrder(parseGuestOrders(store.get(GUEST_ORDERS_COOKIE)?.value), entry);
  store.set(GUEST_ORDERS_COOKIE, serializeGuestOrders(next), {
    httpOnly: true,
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_DAYS * 24 * 60 * 60,
  });
}

/** Removes one order from this device's list (the order itself is untouched). */
export async function forgetGuestOrder(orderNumber: string): Promise<void> {
  const store = await cookies();
  const next = parseGuestOrders(store.get(GUEST_ORDERS_COOKIE)?.value).filter(
    (entry) => entry.orderNumber !== orderNumber,
  );
  store.set(GUEST_ORDERS_COOKIE, serializeGuestOrders(next), {
    httpOnly: true,
    secure: siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_DAYS * 24 * 60 * 60,
  });
}
