import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DatabaseHandle } from "@/lib/db/client";
import { listPendingMigrations, runMigrations } from "@/lib/db/migrate";

const MIGRATION_DIR = path.join(process.cwd(), "db", "migrations");

const PHASE5_TABLES = [
  "legal_settings",
  "legal_document_versions",
  "legal_third_parties",
  "data_retention_settings",
  "accessibility_reviews",
  "asset_licenses",
  "legal_readiness_items",
  "privacy_requests",
  "email_subscriptions",
  "consent_events",
  "cookie_consents",
];

type RawClient = {
  query: <T>(sql: string) => Promise<{ rows: T[] } | T[]>;
  exec: (sql: string) => Promise<unknown>;
};

async function rows<T>(handle: DatabaseHandle, sql: string): Promise<T[]> {
  const result = await (handle.client as unknown as RawClient).query<T>(sql);
  return Array.isArray(result) ? result : result.rows;
}

async function exec(handle: DatabaseHandle, sql: string): Promise<void> {
  await (handle.client as unknown as RawClient).exec(sql);
}

async function scalar(handle: DatabaseHandle, sql: string): Promise<number> {
  const result = await rows<{ value: number | string }>(handle, sql);
  return Number(result[0]?.value ?? 0);
}

async function tableExists(handle: DatabaseHandle, table: string): Promise<boolean> {
  const result = await rows<{ table_name: string }>(
    handle,
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  return result.length === 1;
}

describe("0005 to 0007 migration upgrade", () => {
  let handle: DatabaseHandle;
  let partialDir: string;

  beforeAll(async () => {
    handle = await createDatabase({ dataDir: "memory://", connectionString: "" });
    partialDir = await mkdtemp(path.join(tmpdir(), "esimprove-migrations-"));
    for (const file of [
      "0001_initial.sql",
      "0002_phase2_foundation.sql",
      "0003_phase2_completion.sql",
      "0004_supplier_connect.sql",
      "0005_seo_blog_analytics.sql",
    ]) {
      await copyFile(path.join(MIGRATION_DIR, file), path.join(partialDir, file));
    }

    await runMigrations(handle.client, handle.dialect, { migrationDir: partialDir });

    await exec(
      handle,
      `
      INSERT INTO users (id, email, name, password_hash)
      VALUES ('user_upgrade', 'upgrade@example.test', 'Upgrade User', 'unused');

      INSERT INTO regions (id, slug, name, description)
      VALUES ('region_upgrade', 'upgrade-region', 'Upgrade Region', 'Upgrade region description');

      INSERT INTO destinations
        (id, region_id, slug, country_code, name, summary, description)
      VALUES
        ('destination_upgrade', 'region_upgrade', 'upgrade-destination', 'UP',
         'Upgrade Destination', 'Summary', 'Description');

      INSERT INTO plans
        (id, destination_id, slug, name, supplier_key, supplier_product_id,
         data_mb, validity_days, cost_minor, markup_bps, price_minor,
         coverage_summary, network_summary, description, features)
      VALUES
        ('plan_upgrade', 'destination_upgrade', 'upgrade-plan', 'Upgrade Plan',
         'mock', 'mock-upgrade', 1024, 7, 500, 0, 1000,
         'Coverage', 'Network', 'Description', '[]'::jsonb);

      INSERT INTO orders
        (id, order_number, email, customer_name, country, user_id,
         subtotal_minor, tax_minor, total_minor, currency, idempotency_key, terms_version)
      VALUES
        ('order_upgrade', 'ORD-UPGRADE', 'upgrade@example.test', 'Upgrade User',
         'PT', 'user_upgrade', 1000, 0, 1000, 'USD', 'idempotency_upgrade', 'draft');

      INSERT INTO support_tickets (id, user_id, order_id, subject)
      VALUES ('ticket_upgrade', 'user_upgrade', 'order_upgrade', 'Upgrade ticket');
      `,
    );
  });

  afterAll(async () => {
    await handle.close();
    await rm(partialDir, { recursive: true, force: true });
  });

  it("starts from a representative 0005 schema without Phase 5 objects", async () => {
    const applied = await rows<{ id: string }>(
      handle,
      "SELECT id FROM schema_migrations ORDER BY id",
    );
    expect(applied.map((row) => row.id)).toEqual([
      "0001_initial.sql",
      "0002_phase2_foundation.sql",
      "0003_phase2_completion.sql",
      "0004_supplier_connect.sql",
      "0005_seo_blog_analytics.sql",
    ]);

    for (const table of PHASE5_TABLES) {
      expect(await tableExists(handle, table), `${table} must not exist yet`).toBe(false);
    }

    const columns = await rows<{ column_name: string }>(
      handle,
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'support_tickets'`,
    );
    expect(columns.map((row) => row.column_name)).not.toContain("requester_email");

    expect(await scalar(handle, "SELECT count(*)::int AS value FROM users")).toBe(1);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM orders")).toBe(1);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM plans")).toBe(1);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM support_tickets")).toBe(1);

    const staged = await listPendingMigrations(handle.client, {
      migrationDir: partialDir,
    });
    expect(staged.checked).toBe(true);
    expect(staged.applied).toHaveLength(5);
    expect(staged.pending).toEqual([]);

    const full = await listPendingMigrations(handle.client);
    expect(full.checked).toBe(true);
    expect(full.pending).toEqual([
      "0006_legal_compliance.sql",
      "0007_rate_limit_counter_cleanup.sql",
      "0008_owner_first_login_password_change.sql",
      "0009_account_refund_support_workflows.sql",
    ]);
  });

  it("applies 0006 and 0007 without losing representative rows", async () => {
    await runMigrations(handle.client, handle.dialect);

    const applied = await rows<{ id: string }>(
      handle,
      "SELECT id FROM schema_migrations ORDER BY id",
    );
    expect(applied.map((row) => row.id)).toContain("0006_legal_compliance.sql");
    expect(applied.map((row) => row.id)).toContain("0007_rate_limit_counter_cleanup.sql");
    expect(applied.map((row) => row.id)).toContain("0008_owner_first_login_password_change.sql");
    expect(applied.map((row) => row.id)).toContain("0009_account_refund_support_workflows.sql");
    expect(applied).toHaveLength(9);

    const status = await listPendingMigrations(handle.client);
    expect(status.checked).toBe(true);
    expect(status.pending).toEqual([]);

    const rateLimitIndexes = await rows<{ indexname: string }>(
      handle,
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'rate_limit_counters'`,
    );
    expect(rateLimitIndexes.map((row) => row.indexname)).toContain(
      "rate_limit_counters_window_start_idx",
    );

    for (const table of PHASE5_TABLES) {
      expect(await tableExists(handle, table), `${table} must exist after 0006`).toBe(true);
    }

    const columns = await rows<{
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      handle,
      `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'support_tickets'
         AND column_name = 'requester_email'`,
    );
    expect(columns).toHaveLength(1);
    expect(columns[0]!.data_type).toBe("text");
    expect(columns[0]!.is_nullable).toBe("NO");
    expect(columns[0]!.column_default).toContain("''");

    const [ticket] = await rows<{ id: string; requester_email: string; subject: string }>(
      handle,
      "SELECT id, requester_email, subject FROM support_tickets WHERE id = 'ticket_upgrade'",
    );
    expect(ticket?.subject).toBe("Upgrade ticket");
    expect(ticket?.requester_email).toBe("");

    expect(await scalar(handle, "SELECT count(*)::int AS value FROM users")).toBe(1);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM orders")).toBe(1);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM plans")).toBe(1);
    expect(
      await scalar(
        handle,
        "SELECT count(*)::int AS value FROM orders WHERE id = 'order_upgrade' AND total_minor = 1000",
      ),
    ).toBe(1);

    expect(await scalar(handle, "SELECT count(*)::int AS value FROM legal_settings")).toBe(1);
    expect(
      await scalar(handle, "SELECT count(*)::int AS value FROM legal_document_versions"),
    ).toBe(5);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM legal_third_parties")).toBe(6);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM asset_licenses")).toBe(7);
    expect(
      await scalar(handle, "SELECT count(*)::int AS value FROM data_retention_settings"),
    ).toBe(8);
    expect(
      await scalar(handle, "SELECT count(*)::int AS value FROM accessibility_reviews"),
    ).toBe(5);
    expect(
      await scalar(handle, "SELECT count(*)::int AS value FROM legal_readiness_items"),
    ).toBe(15);

    const accountColumns = await rows<{ column_name: string }>(
      handle,
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'support_tickets'
         AND column_name IN ('category', 'assigned_to', 'assigned_at', 'closed_at')`,
    );
    expect(accountColumns).toHaveLength(4);
    const refundColumns = await rows<{ column_name: string }>(
      handle,
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'refunds'
         AND column_name IN ('resolution_note', 'resolved_by', 'resolved_at')`,
    );
    expect(refundColumns).toHaveLength(3);
    const resetColumns = await rows<{ column_name: string }>(
      handle,
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_resets'
         AND column_name = 'purpose'`,
    );
    expect(resetColumns).toHaveLength(1);
    const [ticketAfter] = await rows<{ id: string; category: string }>(
      handle,
      "SELECT id, category FROM support_tickets WHERE id = 'ticket_upgrade'",
    );
    expect(ticketAfter?.category).toBe("general");
    expect(
      await scalar(
        handle,
        "SELECT count(*)::int AS value FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'password_resets_purpose_idx'",
      ),
    ).toBe(1);
  });

  it("re-applying 0006 and 0007 is a no-op", async () => {
    const [before] = await rows<{ applied_at: string | Date }>(
      handle,
      "SELECT applied_at FROM schema_migrations WHERE id = '0006_legal_compliance.sql'",
    );
    const beforeAppliedAt = new Date(before!.applied_at).getTime();
    const seedCountsBefore = {
      legal: await scalar(handle, "SELECT count(*)::int AS value FROM legal_settings"),
      versions: await scalar(handle, "SELECT count(*)::int AS value FROM legal_document_versions"),
      retention: await scalar(
        handle,
        "SELECT count(*)::int AS value FROM data_retention_settings",
      ),
      tickets: await scalar(handle, "SELECT count(*)::int AS value FROM support_tickets"),
    };

    await runMigrations(handle.client, handle.dialect);

    const [after] = await rows<{ applied_at: string | Date }>(
      handle,
      "SELECT applied_at FROM schema_migrations WHERE id = '0006_legal_compliance.sql'",
    );
    expect(new Date(after!.applied_at).getTime()).toBe(beforeAppliedAt);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM schema_migrations")).toBe(9);

    // The file itself must also be idempotent if an operator re-runs it by hand.
    const sql = await readFile(path.join(MIGRATION_DIR, "0006_legal_compliance.sql"), "utf8");
    await exec(handle, sql);
    const cleanupSql = await readFile(
      path.join(MIGRATION_DIR, "0007_rate_limit_counter_cleanup.sql"),
      "utf8",
    );
    await exec(handle, cleanupSql);
    await exec(handle, cleanupSql);

    const accountSql = await readFile(
      path.join(MIGRATION_DIR, "0009_account_refund_support_workflows.sql"),
      "utf8",
    );
    await exec(handle, accountSql);
    await exec(handle, accountSql);

    expect(
      await scalar(handle, "SELECT count(*)::int AS value FROM legal_settings"),
    ).toBe(seedCountsBefore.legal);
    expect(
      await scalar(handle, "SELECT count(*)::int AS value FROM legal_document_versions"),
    ).toBe(seedCountsBefore.versions);
    expect(
      await scalar(handle, "SELECT count(*)::int AS value FROM data_retention_settings"),
    ).toBe(seedCountsBefore.retention);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM support_tickets")).toBe(
      seedCountsBefore.tickets,
    );
    expect(
      await scalar(
        handle,
        `SELECT count(*)::int AS value FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'rate_limit_counters'
           AND indexname = 'rate_limit_counters_window_start_idx'`,
      ),
    ).toBe(1);
    expect(await scalar(handle, "SELECT count(*)::int AS value FROM schema_migrations")).toBe(9);
  });
});
