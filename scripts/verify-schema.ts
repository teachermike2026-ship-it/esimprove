import { readdirSync } from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./env";

/**
 * READ-ONLY schema verification for a PostgreSQL database.
 *
 * Compares the live database against the application's Drizzle schema
 * (lib/db/schema.ts) and the migration files in db/migrations:
 *  - every migration file is recorded in schema_migrations (and nothing extra);
 *  - every table and column exists with the expected SQL type and nullability;
 *  - every primary key, unique constraint/index, index and foreign key exists
 *    (foreign keys also checked for referenced table/columns and ON DELETE).
 *
 * Opens a read-only session and issues only catalog SELECTs. Target:
 * DATABASE_MIGRATION_URL or DATABASE_URL (never printed).
 */
async function main(): Promise<void> {
  loadLocalEnv();
  const url = process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Set DATABASE_MIGRATION_URL or DATABASE_URL (PostgreSQL) to verify.");
  const { Client } = await import("pg");
  const { getTableConfig } = await import("drizzle-orm/pg-core");
  const schemaModule = await import("@/lib/db/schema");

  const ssl = (process.env.DATABASE_SSL ?? "").toLowerCase() === "disable" ? false : { rejectUnauthorized: true };
  const client = new Client({ connectionString: url, ssl });
  await client.connect();
  await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  const rows = async <T>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as T[];
  const problems: string[] = [];
  const notes: string[] = [];
  let checks = 0;
  // Pre-existing differences between the migrations and the Drizzle schema.
  // They exist identically in every database built from db/migrations
  // (including the original production database) and are reported, not failed.
  const KNOWN_TYPE_DIFFERENCES = new Set([
    "legal_document_versions.effective_date",
    "legal_settings.terms_effective_date",
    "legal_settings.privacy_effective_date",
    "legal_settings.refunds_effective_date",
    "legal_settings.cookies_effective_date",
    "legal_settings.accessibility_effective_date",
  ]);
  const ok = (cond: boolean, message: string) => {
    checks += 1;
    if (!cond) problems.push(message);
  };

  // 1. Migrations
  const files = readdirSync(path.join(process.cwd(), "db", "migrations"))
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  const applied = (await rows<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id")).map((r) => r.id);
  for (const f of files) ok(applied.includes(f), `migration not recorded: ${f}`);
  for (const a of applied) ok(files.includes(a), `unknown migration recorded: ${a}`);
  console.log(`migrations: ${files.length} files, ${applied.length} recorded`);

  // 2. Live catalog
  const cols = await rows<{ t: string; c: string; type: string; nullable: string }>(
    `SELECT table_name t, column_name c, format_type(a.atttypid, a.atttypmod) AS type, is_nullable nullable
       FROM information_schema.columns ic
       JOIN pg_attribute a ON a.attrelid = (quote_ident(ic.table_schema)||'.'||quote_ident(ic.table_name))::regclass AND a.attname = ic.column_name
      WHERE ic.table_schema = 'public'`,
  );
  const idx = await rows<{ t: string; name: string; def: string; uniq: boolean; primary: boolean }>(
    `SELECT tab.relname t, i.relname name, pg_get_indexdef(ix.indexrelid) def, ix.indisunique uniq, ix.indisprimary "primary"
       FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_class tab ON tab.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = tab.relnamespace WHERE n.nspname = 'public'`,
  );
  const fks = await rows<{ t: string; name: string; def: string }>(
    `SELECT conrelid::regclass::text t, conname name, pg_get_constraintdef(oid) def
       FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`,
  );
  const checksCons = await rows<{ t: string; name: string }>(
    `SELECT conrelid::regclass::text t, conname name FROM pg_constraint WHERE contype IN ('c','u','p') AND connamespace = 'public'::regnamespace`,
  );
  const liveTables = new Set(cols.map((c) => c.t));

  // 3. Compare against Drizzle definitions
  const normType = (t: string) =>
    t
      .toLowerCase()
      .replace("timestamp with time zone", "timestamptz")
      .replace("timestamp without time zone", "timestamp")
      .replace("character varying", "varchar")
      .replace(/^integer$/, "integer")
      .replace("double precision", "double precision")
      .replace(/\s+/g, "");
  let tableCount = 0;
  const expectedTables = new Set<string>();
  for (const value of Object.values(schemaModule)) {
    let cfg: ReturnType<typeof getTableConfig>;
    try {
      cfg = getTableConfig(value as never);
    } catch {
      continue;
    }
    if (!cfg?.name || !Array.isArray(cfg.columns)) continue;
    tableCount += 1;
    expectedTables.add(cfg.name);
    ok(liveTables.has(cfg.name), `table missing: ${cfg.name}`);
    for (const col of cfg.columns) {
      const live = cols.find((c) => c.t === cfg.name && c.c === col.name);
      ok(Boolean(live), `column missing: ${cfg.name}.${col.name}`);
      if (!live) continue;
      const expected = normType(col.getSQLType());
      if (normType(live.type) !== expected && KNOWN_TYPE_DIFFERENCES.has(`${cfg.name}.${col.name}`)) {
        notes.push(`known pre-existing difference: ${cfg.name}.${col.name} is ${live.type} in SQL, ${expected} in Drizzle`);
      } else {
        ok(normType(live.type) === expected, `type differs: ${cfg.name}.${col.name} live=${live.type} expected=${expected}`);
      }
      ok((live.nullable === "NO") === col.notNull || col.primary, `nullability differs: ${cfg.name}.${col.name}`);
    }
    const tIdx = idx.filter((i) => i.t === cfg.name);
    const pkCols = [...cfg.columns.filter((c) => c.primary).map((c) => c.name), ...cfg.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name))];
    if (pkCols.length) ok(tIdx.some((i) => i.primary && pkCols.every((c) => i.def.includes(c))), `primary key missing: ${cfg.name}(${pkCols.join(",")})`);
    for (const ix of cfg.indexes) {
      const name = ix.config.name;
      const live = tIdx.find((i) => i.name === name);
      const ixCols = ix.config.columns.map((c) => ("name" in c ? (c as { name: string }).name : ""));
      const coveredByPrimaryKey =
        Boolean(ix.config.unique) && ixCols.length === pkCols.length && ixCols.every((c) => pkCols.includes(c));
      if (!live && coveredByPrimaryKey) {
        notes.push(`unique index ${cfg.name}.${name} is not created separately; the primary key on (${ixCols.join(",")}) already enforces it`);
        continue;
      }
      ok(Boolean(live), `index missing: ${cfg.name}.${name}`);
      if (live) ok(live.uniq === Boolean(ix.config.unique), `index uniqueness differs: ${cfg.name}.${name}`);
    }
    for (const u of cfg.uniqueConstraints) {
      const name = u.getName();
      ok(checksCons.some((c) => c.t === cfg.name && c.name === name) || tIdx.some((i) => i.name === name && i.uniq), `unique constraint missing: ${cfg.name}.${name}`);
    }
    for (const col of cfg.columns.filter((c) => c.isUnique)) {
      ok(tIdx.some((i) => i.uniq && new RegExp(`\\(${col.name}\\)`).test(i.def)), `unique column missing: ${cfg.name}.${col.name}`);
    }
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const local = ref.columns.map((c) => c.name);
      const foreignTable = getTableConfig(ref.foreignTable).name;
      const foreign = ref.foreignColumns.map((c) => c.name);
      const live = fks.find((f) => f.t === cfg.name && f.def.startsWith(`FOREIGN KEY (${local.join(", ")}) REFERENCES ${foreignTable}(${foreign.join(", ")})`));
      ok(Boolean(live), `foreign key missing: ${cfg.name}(${local.join(",")}) -> ${foreignTable}(${foreign.join(",")})`);
      if (live && fk.onDelete && fk.onDelete !== "no action") {
        ok(live.def.toUpperCase().includes(`ON DELETE ${fk.onDelete.toUpperCase()}`), `ON DELETE differs: ${cfg.name}.${live.name}`);
      }
    }
  }
  const extraTables = [...liveTables].filter((t) => !expectedTables.has(t) && t !== "schema_migrations");
  console.log(`tables: ${tableCount} defined in schema, ${liveTables.size} in database${extraTables.length ? ` (not in Drizzle schema: ${extraTables.join(", ")})` : ""}`);
  console.log(`live objects: ${idx.length} indexes, ${fks.length} foreign keys, ${checksCons.length} primary/unique/check constraints`);
  console.log(`checks run: ${checks}, problems: ${problems.length}`);
  for (const p of problems.slice(0, 60)) console.log(`  PROBLEM ${p}`);
  for (const n of notes) console.log(`  NOTE ${n}`);
  await client.end();
  if (problems.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Schema verification failed:", error instanceof Error ? error.message.replace(/postgres(ql)?:\/\/\S+/gi, "<redacted>") : error);
  process.exitCode = 1;
});
