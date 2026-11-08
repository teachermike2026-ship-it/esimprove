import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Blog featured images are administrator-supplied absolute URLs. No external
  // media host or Next image optimization allowlist is configured (BLOCKED),
  // and proxying arbitrary remote URLs through /_next/image would add an
  // SSRF-like fetch surface. Keep native <img> for these admin-managed images;
  // revisit when the media host and remotePatterns are approved.
  {
    files: ["app/blog/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "scripts/**",
  ]),
]);
