import { inArray, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  analyticsEvents,
  analyticsSessions,
  analyticsVisitors,
  dataRetentionSettings,
} from "@/lib/db/schema";

/**
 * Single source of truth for automated analytics retention.
 *
 * `data_retention_settings` is authoritative. The TypeScript values below are
 * proposed technical defaults for an unmigrated or incomplete database; they
 * are NOT owner-approved policy and are never used to enable deletion on their
 * own. Migration 0006 seeds the same numbers with basis `technical_default` and
 * asks the owner to confirm the final periods.
 *
 * Fail-closed rules:
 * - A database read failure returns a disabled policy (no deletion).
 * - A missing row disables that category.
 * - A row only permits cleanup when `enabled = true`, `automated = true`, and
 *   the period is a valid whole number of days.
 * - An invalid period disables that category rather than silently falling back
 *   to a default and deleting data.
 *
 * Consent validity (CONSENT_VALIDITY_DAYS = 180 in lib/legal.ts) is a separate
 * policy. It controls how long a consent record may be relied on; it never
 * changes how long analytics data is retained.
 */

export const ANALYTICS_RETENTION_KEYS = [
  "analytics_events",
  "analytics_aggregates",
] as const;

export type AnalyticsRetentionKey = (typeof ANALYTICS_RETENTION_KEYS)[number];

export const DEFAULT_ANALYTICS_RETENTION_DAYS = {
  analytics_events: 395,
  analytics_aggregates: 730,
} as const satisfies Record<AnalyticsRetentionKey, number>;

export const MIN_RETENTION_DAYS = 1;
// An explicit upper bound prevents a typo or direct database edit from turning
// a cleanup rule into an accidental no-op (or an integer overflow).
export const MAX_RETENTION_DAYS = 36500;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionSource = "database" | "default" | "override";

export interface AnalyticsRetentionPolicy {
  eventsDays: number;
  aggregatesDays: number;
  eventsSource: RetentionSource;
  aggregatesSource: RetentionSource;
  eventsEnabled: boolean;
  aggregatesEnabled: boolean;
  /** True only when the settings table was read successfully. */
  databaseAvailable: boolean;
}

export function isAnalyticsRetentionKey(
  value: string,
): value is AnalyticsRetentionKey {
  return (ANALYTICS_RETENTION_KEYS as readonly string[]).includes(value);
}

/**
 * Retention periods are positive whole days within the supported range. A
 * zero, negative, fractional, out-of-range, or non-numeric value is invalid and
 * disables cleanup for that category.
 */
export function normalizeRetentionDays(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const days = Math.floor(value);
  return isRetentionDaysInRange(days) ? days : null;
}

export function isRetentionDaysInRange(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_RETENTION_DAYS &&
    value <= MAX_RETENTION_DAYS
  );
}

function disabledPolicy(): AnalyticsRetentionPolicy {
  return {
    eventsDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_events,
    aggregatesDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_aggregates,
    eventsSource: "default",
    aggregatesSource: "default",
    eventsEnabled: false,
    aggregatesEnabled: false,
    databaseAvailable: false,
  };
}

export async function loadAnalyticsRetentionPolicy(
  db: Database,
): Promise<AnalyticsRetentionPolicy> {
  const policy = disabledPolicy();

  let rows: {
    dataKey: string;
    retentionDays: number | null;
    automated: boolean;
    enabled: boolean;
  }[];

  try {
    rows = await db
      .select({
        dataKey: dataRetentionSettings.dataKey,
        retentionDays: dataRetentionSettings.retentionDays,
        automated: dataRetentionSettings.automated,
        enabled: dataRetentionSettings.enabled,
      })
      .from(dataRetentionSettings)
      .where(inArray(dataRetentionSettings.dataKey, [...ANALYTICS_RETENTION_KEYS]));
  } catch (error) {
    // Missing table (pre-migration) and connection failures are both
    // non-destructive: nothing is deleted without a readable, explicit policy.
    console.error(
      "Analytics retention policy unavailable; skipping cleanup",
      error instanceof Error ? error.name : "unknown error",
    );
    return policy;
  }

  policy.databaseAvailable = true;

  for (const row of rows) {
    const days = normalizeRetentionDays(row.retentionDays);
    const permitted = row.enabled === true && row.automated === true && days !== null;

    if (row.dataKey === "analytics_events") {
      if (days !== null) {
        policy.eventsDays = days;
        policy.eventsSource = "database";
      }
      policy.eventsEnabled = permitted;
    } else if (row.dataKey === "analytics_aggregates") {
      if (days !== null) {
        policy.aggregatesDays = days;
        policy.aggregatesSource = "database";
      }
      policy.aggregatesEnabled = permitted;
    }
  }

  return policy;
}

export interface AnalyticsCleanupOverrides {
  eventsDays?: number;
  aggregatesDays?: number;
  eventsEnabled?: boolean;
  aggregatesEnabled?: boolean;
}

export interface AnalyticsCleanupResult {
  events: number;
  sessions: number;
  visitors: number;
  policy: AnalyticsRetentionPolicy;
}

/**
 * Deletes raw events and aggregate rows using independent cutoffs. An explicit
 * numeric override applies the same window to both categories (used by tests
 * and manual operations); production callers pass no override so the database
 * policy is authoritative.
 *
 * When the policy cannot be read, or when a category is not explicitly enabled
 * and automated, that category is left untouched.
 */
export async function cleanupAnalytics(
  db: Database,
  overrides?: number | AnalyticsCleanupOverrides,
): Promise<AnalyticsCleanupResult> {
  const policy = await loadAnalyticsRetentionPolicy(db);

  if (typeof overrides === "number") {
    const days = normalizeRetentionDays(overrides);
    if (days !== null) {
      policy.eventsDays = days;
      policy.aggregatesDays = days;
      policy.eventsSource = "override";
      policy.aggregatesSource = "override";
    }
  } else if (overrides) {
    const eventsDays = normalizeRetentionDays(overrides.eventsDays);
    if (eventsDays !== null) {
      policy.eventsDays = eventsDays;
      policy.eventsSource = "override";
    }
    const aggregatesDays = normalizeRetentionDays(overrides.aggregatesDays);
    if (aggregatesDays !== null) {
      policy.aggregatesDays = aggregatesDays;
      policy.aggregatesSource = "override";
    }
    if (overrides.eventsEnabled !== undefined) {
      policy.eventsEnabled = overrides.eventsEnabled;
    }
    if (overrides.aggregatesEnabled !== undefined) {
      policy.aggregatesEnabled = overrides.aggregatesEnabled;
    }
  }

  const now = Date.now();
  const eventsCutoff = new Date(now - policy.eventsDays * DAY_MS);
  const aggregatesCutoff = new Date(now - policy.aggregatesDays * DAY_MS);

  const deletedEvents = policy.eventsEnabled
    ? await db
        .delete(analyticsEvents)
        .where(lt(analyticsEvents.createdAt, eventsCutoff))
        .returning({ id: analyticsEvents.id })
    : [];
  const deletedSessions = policy.aggregatesEnabled
    ? await db
        .delete(analyticsSessions)
        .where(lt(analyticsSessions.lastSeen, aggregatesCutoff))
        .returning({ id: analyticsSessions.id })
    : [];
  const deletedVisitors = policy.aggregatesEnabled
    ? await db
        .delete(analyticsVisitors)
        .where(lt(analyticsVisitors.lastSeen, aggregatesCutoff))
        .returning({ id: analyticsVisitors.id })
    : [];

  return {
    events: deletedEvents.length,
    sessions: deletedSessions.length,
    visitors: deletedVisitors.length,
    policy,
  };
}
