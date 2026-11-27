/**
 * eSIM Access operations for the admin console: balance checks, low-balance
 * alerts, API health, catalogue synchronisation and plan margins.
 *
 * The balance is never invented. A failed or impossible lookup is recorded as
 * a health-check failure and the LAST KNOWN balance (with its timestamp) is
 * kept unchanged. Balance lookups are read-only and never move money.
 */
import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  apiHealthChecks,
  auditLogs,
  planPriceHistory,
  plans,
  providerBalanceSnapshots,
  providerSyncJobs,
} from "@/lib/db/schema";
import { flags } from "@/lib/config";
import { esimAccessCredentials } from "@/lib/integrations/supplier/esimaccess";
import { fetchEsimAccessBalanceMinor, reservedSupplierCostMinor } from "@/lib/fulfillment-readiness";
import { getSystemSetting, recordApiHealthCheck, recordProviderBalanceSnapshot, updateSystemSetting } from "@/lib/operations";
import { recordAudit } from "@/lib/audit";

export const SUPPLIER_KEY = "esimaccess";
const THRESHOLD_SETTING = "supplier.low_balance";
const DEFAULT_THRESHOLD_MINOR = 2000; // $20.00
/** The same unresolved supplier alert is not repeated within this window. */
export const ALERT_REPEAT_HOURS = 6;

export async function getLowBalanceThresholdMinor(db: Database): Promise<number> {
  const setting = (await getSystemSetting(db, THRESHOLD_SETTING)) as { thresholdMinor?: unknown } | null;
  const stored = Number(setting?.thresholdMinor);
  if (Number.isSafeInteger(stored) && stored >= 0) return stored;
  const env = process.env.SUPPLIER_LOW_BALANCE_USD?.trim();
  if (env && /^\d{1,6}(\.\d{1,2})?$/.test(env)) return Math.round(Number(env) * 100);
  return DEFAULT_THRESHOLD_MINOR;
}

export async function setLowBalanceThresholdMinor(db: Database, thresholdMinor: number, adminId: string): Promise<void> {
  if (!Number.isSafeInteger(thresholdMinor) || thresholdMinor < 0 || thresholdMinor > 10_000_000) {
    throw new Error("Threshold must be between $0 and $100,000");
  }
  const previous = await getLowBalanceThresholdMinor(db);
  await updateSystemSetting(db, THRESHOLD_SETTING, { thresholdMinor });
  await recordAudit(db, {
    actorType: "admin",
    actorId: adminId,
    action: "supplier.low_balance_threshold.updated",
    entityType: "setting",
    entityId: THRESHOLD_SETTING,
    metadata: { previousMinor: previous, newMinor: thresholdMinor },
  });
}

type BalanceFetcher = () => Promise<number>;

export interface SupplierCheckResult {
  ok: boolean;
  balanceMinor: number | null;
  message: string;
  alerts: string[];
}

function sanitize(message: string): string {
  return message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]").slice(0, 300);
}

/** Records an alert once per window (deduplicated by action name). */
async function raiseSupplierAlert(db: Database, action: string, summary: string, metadata: Record<string, unknown>) {
  const since = new Date(Date.now() - ALERT_REPEAT_HOURS * 3_600_000);
  const recent = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, action), gte(auditLogs.createdAt, since)))
    .limit(1);
  if (recent.length > 0) return false;
  await recordAudit(db, {
    actorType: "system",
    action,
    entityType: "supplier",
    entityId: SUPPLIER_KEY,
    metadata: { summary, ...metadata },
  });
  console.warn(`[admin alert] ${action}: ${summary}`);
  return true;
}

/**
 * Reads the live balance once (read-only), records it and the API health,
 * and raises deduplicated alerts. `fetcher` replaces the network call in tests.
 */
export async function checkSupplierNow(db: Database, options: { fetcher?: BalanceFetcher } = {}): Promise<SupplierCheckResult> {
  const alerts: string[] = [];
  const credentials = esimAccessCredentials();
  if (!credentials && !options.fetcher) {
    await recordApiHealthCheck(db, {
      target: `${SUPPLIER_KEY}.balance`,
      method: "POST",
      status: "unconfigured",
      message: "ESIM_ACCESS_CODE / ESIM_SECRET_KEY are not set",
    });
    return { ok: false, balanceMinor: null, message: "eSIM Access credentials are not configured.", alerts };
  }

  const started = Date.now();
  let balanceMinor: number;
  try {
    balanceMinor = options.fetcher ? await options.fetcher() : await fetchEsimAccessBalanceMinor(credentials!);
  } catch (error) {
    const message = sanitize(error instanceof Error ? error.message : String(error));
    await recordApiHealthCheck(db, {
      target: `${SUPPLIER_KEY}.balance`,
      method: "POST",
      status: "error",
      latencyMs: Date.now() - started,
      message,
    });
    if (await raiseSupplierAlert(db, "alert.supplier.balance_unavailable", "Supplier balance could not be read", { message })) {
      alerts.push("balance_unavailable");
    }
    // The last known balance is deliberately left unchanged.
    return { ok: false, balanceMinor: null, message: `Balance could not be read: ${message}`, alerts };
  }

  await recordApiHealthCheck(db, {
    target: `${SUPPLIER_KEY}.balance`,
    method: "POST",
    status: "ok",
    latencyMs: Date.now() - started,
  });
  await recordProviderBalanceSnapshot(db, { providerKey: SUPPLIER_KEY, balanceMinor, currency: "USD" });

  const threshold = await getLowBalanceThresholdMinor(db);
  const reserved = await reservedSupplierCostMinor(db);
  if (balanceMinor < threshold) {
    if (await raiseSupplierAlert(db, "alert.supplier.low_balance", "Supplier balance is below the threshold", { balanceMinor, threshold })) {
      alerts.push("low_balance");
    }
  }
  if (balanceMinor < reserved) {
    if (
      await raiseSupplierAlert(db, "alert.supplier.insufficient_for_pending", "Balance does not cover orders waiting for eSIMs", {
        balanceMinor,
        reservedMinor: reserved,
      })
    ) {
      alerts.push("insufficient_for_pending");
    }
  }
  return { ok: true, balanceMinor, message: "Balance read successfully.", alerts };
}

export async function getSupplierStatus(db: Database) {
  const [snapshot, checks, lastOk, lastSync, priceChanges, planCounts, threshold, reserved, recentAlerts] = await Promise.all([
    db
      .select()
      .from(providerBalanceSnapshots)
      .where(eq(providerBalanceSnapshots.providerKey, SUPPLIER_KEY))
      .orderBy(desc(providerBalanceSnapshots.capturedAt))
      .limit(1),
    db
      .select()
      .from(apiHealthChecks)
      .where(like(apiHealthChecks.target, `${SUPPLIER_KEY}%`))
      .orderBy(desc(apiHealthChecks.checkedAt))
      .limit(15),
    db
      .select({ checkedAt: apiHealthChecks.checkedAt })
      .from(apiHealthChecks)
      .where(and(like(apiHealthChecks.target, `${SUPPLIER_KEY}%`), eq(apiHealthChecks.status, "ok")))
      .orderBy(desc(apiHealthChecks.checkedAt))
      .limit(1),
    db.select().from(providerSyncJobs).orderBy(desc(providerSyncJobs.startedAt)).limit(5),
    db
      .select()
      .from(planPriceHistory)
      .where(gte(planPriceHistory.effectiveAt, new Date(Date.now() - 30 * 86_400_000)))
      .orderBy(desc(planPriceHistory.effectiveAt))
      .limit(20),
    db
      .select({ status: plans.status, n: sql<number>`count(*)::int` })
      .from(plans)
      .where(eq(plans.supplierKey, SUPPLIER_KEY))
      .groupBy(plans.status),
    getLowBalanceThresholdMinor(db),
    reservedSupplierCostMinor(db).catch(() => null),
    db
      .select()
      .from(auditLogs)
      .where(like(auditLogs.action, "alert.supplier.%"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);
  const last = snapshot[0] ?? null;
  const latest = checks[0] ?? null;
  return {
    credentialsConfigured: esimAccessCredentials() !== null,
    liveOrdering: flags.supplierLive,
    lastBalanceMinor: last?.balanceMinor ?? null,
    lastBalanceAt: last?.capturedAt ?? null,
    thresholdMinor: threshold,
    reservedMinor: reserved,
    apiStatus: latest ? latest.status : "never-checked",
    lastCheckAt: latest?.checkedAt ?? null,
    lastSuccessAt: lastOk[0]?.checkedAt ?? null,
    recentChecks: checks,
    recentErrors: checks.filter((c) => c.status !== "ok"),
    lastSync: lastSync,
    priceChanges,
    planCounts: Object.fromEntries(planCounts.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
    recentAlerts,
  };
}

/** Plan margins: gross margin only (price minus supplier cost), not net profit. */
export async function getPlanMargins(db: Database, limit = 25) {
  const rows = await db
    .select({
      slug: plans.slug,
      name: plans.name,
      priceMinor: plans.priceMinor,
      costMinor: plans.costMinor,
      currency: plans.currency,
    })
    .from(plans)
    .where(and(eq(plans.supplierKey, SUPPLIER_KEY), eq(plans.status, "published")));
  const withMargin = rows.map((r) => ({
    ...r,
    grossMarginMinor: r.priceMinor - r.costMinor,
    marginPercent: r.priceMinor > 0 ? Math.round(((r.priceMinor - r.costMinor) / r.priceMinor) * 1000) / 10 : 0,
  }));
  withMargin.sort((a, b) => a.marginPercent - b.marginPercent);
  return {
    count: withMargin.length,
    lowest: withMargin.slice(0, limit),
    negative: withMargin.filter((r) => r.grossMarginMinor < 0).length,
  };
}
