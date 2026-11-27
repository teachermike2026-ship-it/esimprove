import type { NextConfig } from "next";
import { SUPERSEDED_GUIDES } from "./lib/editorial/index";

// HSTS is emitted only for a production build; preview and local HTTP must not
// pin HSTS in a browser.
const isProductionBuild = (process.env.APP_ENV ?? "").trim().toLowerCase() === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/**/*"],
  },
  async redirects() {
    // Guides whose content moved into a fuller blog article (permanent).
    return Object.entries(SUPERSEDED_GUIDES).flatMap(([oldSlug, newSlug]) => [
      { source: `/guides/${oldSlug}`, destination: `/blog/${newSlug}`, permanent: true },
      {
        source: `/:locale(fr|es|ar)/guides/${oldSlug}`,
        destination: `/:locale/blog/${newSlug}`,
        permanent: true,
      },
    ]);
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // The Content-Security-Policy is emitted per request by proxy.ts so
          // that it can contain a fresh nonce. Do not add a second static CSP
          // here: browsers intersect multiple policies, and a duplicate would
          // block nonced scripts.
          { key: "X-DNS-Prefetch-Control", value: "off" },
          ...(isProductionBuild
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;

