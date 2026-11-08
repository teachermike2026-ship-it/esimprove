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
 * `data_retention_settings` is authoritative. The TypeScript defaults below are
 * fallback-only values for an unmigrated or incomplete database, and they are
 * deliberately identical to the approved seeds in migration 0006:
 * - raw analytics events: 395 days
 * - aggregated sessions and visitors: 730 days
 *
 * Operators can change the values in data_retention_settings (Admin -> Legal &
 * compliance). The environment variable ANALYTICS_RETENTION_DAYS was removed
 * because it could silently disagree with the reviewed database policy.
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
}

export function isAnalyticsRetentionKey(
  value: string,
): value is AnalyticsRetentionKey {
  return (ANALYTICS_RETENTION_KEYS as readonly string[]).includes(value);
}

/**
 * Retention periods are positive whole days within the supported range. A
 * zero, negative, fractional, out-of-range, or non-numeric value is invalid and
 * falls back to the reviewed default rather than deleting everything or
 * silently disabling cleanup.
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

export async function loadAnalyticsRetentionPolicy(
  db: Database,
): Promise<AnalyticsRetentionPolicy> {
  const policy: AnalyticsRetentionPolicy = {
    eventsDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_events,
    aggregatesDays: DEFAULT_ANALYTICS_RETENTION_DAYS.analytics_aggregates,
    eventsSource: "default",
    aggregatesSource: "default",
    eventsEnabled: true,
    aggregatesEnabled: true,
  };

  let rows: {
    dataKey: string;
    retentionDays: number | null;
    enabled: boolean;
  }[];

  try {
    rows = await db
      .select({
        dataKey: dataRetentionSettings.dataKey,
        retentionDays: dataRetentionSettings.retentionDays,
        enabled: dataRetentionSettings.enabled,
      })
      .from(dataRetentionSettings)
      .where(inArray(dataRetentionSettings.dataKey, [...ANALYTICS_RETENTION_KEYS]));
  } catch {
    // The legal tables do not exist before migration 0006 is applied. Defaults
    // keep the Phase 4 cleanup behaviour safe during an upgrade.
    return policy;
  }

  for (const row of rows) {
    const days = normalizeRetentionDays(row.retentionDays);
    if (row.dataKey === "analytics_events") {
      policy.eventsEnabled = row.enabled;
      if (row.enabled && days !== null) {
        policy.eventsDays = days;
        policy.eventsSource = "database";
      }
    } else if (row.dataKey === "analytics_aggregates") {
      policy.aggregatesEnabled = row.enabled;
      if (row.enabled && days !== null) {
        policy.aggregatesDays = days;
        policy.aggregatesSource = "database";
      }
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
