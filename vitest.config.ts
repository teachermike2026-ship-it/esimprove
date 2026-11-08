import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    pool: "forks",
    testTimeout: 30000,
    // PGlite migration + demo seeding can exceed 30s when multiple database
    // handles are created in one hook on Windows. Assertions are unchanged.
    hookTimeout: 60000,
  },
});
