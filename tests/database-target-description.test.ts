import path from "node:path";
import { describe, expect, it } from "vitest";
import { describeDatabaseTarget } from "@/lib/db/target-description";

describe("safe database target description", () => {
  const project = path.resolve("project");
  it("identifies the default directory without connecting", () => {
    expect(describeDatabaseTarget({}, project, project)).toEqual({
      kind: "pglite-directory", target: path.join(project, ".pglite"), isProjectDefault: true,
    });
  });
  it("redacts PostgreSQL connection strings and respects precedence", () => {
    const result = describeDatabaseTarget({ DATABASE_URL: "secret-connection", PGLITE_DATA_DIR: "memory://" }, project, project);
    expect(result).toEqual({ kind: "postgres", target: "redacted" });
    expect(JSON.stringify(result)).not.toContain("secret-connection");
  });
  it("distinguishes memory, overrides, and differing working directories", () => {
    expect(describeDatabaseTarget({ PGLITE_DATA_DIR: "memory://" }, project, project).kind).toBe("pglite-memory");
    expect(describeDatabaseTarget({ PGLITE_DATA_DIR: "../test-db" }, project, project)).toMatchObject({ kind: "pglite-directory", isProjectDefault: false });
    expect(describeDatabaseTarget({}, path.join(project, "other"), project)).toMatchObject({ isProjectDefault: false });
    expect(describeDatabaseTarget({ DATABASE_URL: "" }, project, project)).toMatchObject({ isProjectDefault: true });
  });
});
