import path from "node:path";

export type DatabaseTargetDescription =
  | { kind: "postgres"; target: "redacted" }
  | { kind: "pglite-memory"; target: "memory://" }
  | { kind: "pglite-directory"; target: string; isProjectDefault: boolean };

/** Describe selection without connecting, creating files, or revealing connection credentials. */
export function describeDatabaseTarget(
  environment: Record<string, string | undefined>,
  workingDirectory: string,
  projectDirectory: string,
): DatabaseTargetDescription {
  // Match createDatabase's precedence and truthiness, including an empty URL.
  if (environment.DATABASE_URL) return { kind: "postgres", target: "redacted" };
  const dataDir = environment.PGLITE_DATA_DIR ?? ".pglite";
  if (dataDir === "memory://") return { kind: "pglite-memory", target: "memory://" };
  const target = path.resolve(workingDirectory, dataDir);
  const projectDefault = path.resolve(projectDirectory, ".pglite");
  const normalize = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
  return {
    kind: "pglite-directory",
    target,
    isProjectDefault: normalize(target) === normalize(projectDefault),
  };
}
