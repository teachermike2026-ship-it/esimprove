/**
 * Checkout guard: a customer may only start a payment when the order can
 * actually be fulfilled.
 *
 * - eSIM Access plans need live ordering enabled (SUPPLIER_LIVE_ENABLED=true
 *   and credentials) AND a supplier balance that covers this order plus every
 *   order already paid or awaiting a crypto payment that has not been issued.
 * - Demo/mock plans are only sellable where mock commerce is allowed (never in
 *   production).
 *
 * It fails closed: if the balance cannot be read, checkout is refused. The
 * balance query (/api/v1/open/balance/query) is read-only and never moves
 * money. Results are cached briefly so checkout does not call the supplier on
 * every page view.
 */
import { and, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import type { DatabaseExecutor } from "@/lib/db/client";
import { cryptoPayments, orderItems, orders } from "@/lib/db/schema";
import {
  ESIM_ACCESS_PROVIDER_KEY,
  esimAccessCredentials,
  type EsimAccessCredentials,
} from "@/lib/integrations/supplier/esimaccess";
import { esimAccessRequest } from "@/lib/integrations/supplier/esimaccess-orders";
import { supplierOrderingEnabled } from "@/lib/integrations/supplier";

export const ESIM_ACCESS_BALANCE_PATH = "/api/v1/open/balance/query";
const BALANCE_CACHE_MS = 60_000;

/** Fulfillment statuses that still need the supplier to issue eSIMs. */
const OPEN_FULFILLMENT = ["not_started", "queued", "provisioning", "manual_review", "under_investigation"];

export type ReadinessReason =
  | "supplier_disabled"
  | "insufficient_balance"
  | "balance_unavailable"
  | "demo_not_sellable";

export type FulfillmentReadiness =
  | { ok: true; balanceMinor?: number; requiredMinor?: number; reservedMinor?: number }
  | {
      ok: false;
      reason: ReadinessReason;
      message: string;
      balanceMinor?: number;
      requiredMinor?: number;
      reservedMinor?: number;
    };

export interface ReadinessLine {
  supplierKey: string;
  /** Supplier cost of ONE eSIM, in cents. */
  unitCostMinor: number;
  quantity: number;
}

type BalanceFetcher = () => Promise<number>;
let balanceOverride: BalanceFetcher | null = null;
let cache: { minor: number; at: number } | null = null;

/** Test seam: replace the supplier balance lookup (cents). Resets the cache. */
export function setSupplierBalanceFetcherOverride(fetcher: BalanceFetcher | null): void {
  balanceOverride = fetcher;
  cache = null;
}

/** eSIM Access balance in cents (the API reports 1/10,000 USD). */
export async function fetchEsimAccessBalanceMinor(
  credentials: EsimAccessCredentials,
  fetchImpl?: typeof fetch,
): Promise<number> {
  const obj = await esimAccessRequest<{ balance?: unknown }>(ESIM_ACCESS_BALANCE_PATH, {}, {
    credentials,
    fetchImpl,
    timeoutMs: 8_000,
  });
  const raw = Number(obj?.balance);
  if (!Number.isFinite(raw) || raw < 0) throw new Error("eSIM Access returned an invalid balance");
  return Math.floor(raw / 100);
}

async function supplierBalanceMinor(): Promise<number> {
  if (cache && Date.now() - cache.at < BALANCE_CACHE_MS) return cache.minor;
  let minor: number;
  if (balanceOverride) {
    minor = await balanceOverride();
  } else {
    const credentials = esimAccessCredentials();
    if (!credentials) throw new Error("eSIM Access credentials are not configured");
    minor = await fetchEsimAccessBalanceMinor(credentials);
  }
  cache = { minor, at: Date.now() };
  return minor;
}

/**
 * Supplier cost already committed: eSIM Access items of orders that are paid,
 * or have a crypto payment in progress, and are not issued yet.
 */
export async function reservedSupplierCostMinor(
  db: DatabaseExecutor,
  options: { excludeOrderId?: string; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const activeCrypto = db
    .select({ orderId: cryptoPayments.orderId })
    .from(cryptoPayments)
    .where(
      or(
        eq(cryptoPayments.status, "confirming"),
        and(eq(cryptoPayments.status, "pending"), gt(cryptoPayments.expiresAt, now)),
      ),
    );
  const rows = await db
    .select({ total: sql<string | number | null>`coalesce(sum(${orderItems.costMinor}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orderItems.supplierKey, ESIM_ACCESS_PROVIDER_KEY),
        inArray(orders.fulfillmentStatus, OPEN_FULFILLMENT),
        or(eq(orders.paymentStatus, "paid"), inArray(orders.id, activeCrypto)),
        options.excludeOrderId ? ne(orders.id, options.excludeOrderId) : undefined,
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

const UNAVAILABLE =
  "This eSIM is temporarily unavailable for purchase. No payment was taken. Please try again later or contact support.";

export async function checkFulfillmentReadiness(
  db: DatabaseExecutor,
  lines: ReadinessLine[],
  options: { excludeOrderId?: string } = {},
): Promise<FulfillmentReadiness> {
  const supplierLines = lines.filter((line) => line.supplierKey === ESIM_ACCESS_PROVIDER_KEY);
  const otherLines = lines.filter((line) => line.supplierKey !== ESIM_ACCESS_PROVIDER_KEY);

  if (otherLines.some((line) => !supplierOrderingEnabled(line.supplierKey))) {
    return { ok: false, reason: "demo_not_sellable", message: UNAVAILABLE };
  }
  if (supplierLines.length === 0) return { ok: true };

  if (!supplierOrderingEnabled(ESIM_ACCESS_PROVIDER_KEY)) {
    return { ok: false, reason: "supplier_disabled", message: UNAVAILABLE };
  }

  const requiredMinor = supplierLines.reduce((sum, line) => sum + line.unitCostMinor * line.quantity, 0);
  let balanceMinor: number;
  try {
    balanceMinor = await supplierBalanceMinor();
  } catch (error) {
    console.error(
      "Supplier balance check failed",
      error instanceof Error ? error.name : "unknown error",
    );
    return { ok: false, reason: "balance_unavailable", message: UNAVAILABLE, requiredMinor };
  }
  const reservedMinor = await reservedSupplierCostMinor(db, { excludeOrderId: options.excludeOrderId });
  if (balanceMinor < requiredMinor + reservedMinor) {
    console.error("Supplier balance too low for checkout", {
      balanceMinor,
      requiredMinor,
      reservedMinor,
    });
    return {
      ok: false,
      reason: "insufficient_balance",
      message: UNAVAILABLE,
      balanceMinor,
      requiredMinor,
      reservedMinor,
    };
  }
  return { ok: true, balanceMinor, requiredMinor, reservedMinor };
}
