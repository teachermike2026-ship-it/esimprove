import { NextResponse, type NextRequest } from "next/server";
import { getDbHandle } from "@/lib/db/client";
import { plans } from "@/lib/db/schema";
import { safeEqual } from "@/lib/crypto";
import {
  appEnv,
  demoMode,
  flags,
  getConfigurationProblems,
  integrationModes,
  isProduction,
  mockCommerceAllowed,
  siteUrl,
} from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function detailedAuthorized(request: NextRequest): boolean {
  const token = process.env.HEALTH_CHECK_TOKEN;
  if (!token) return false;
  const headerToken = request.headers.get("x-health-token");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const provided = headerToken ?? bearer;
  return Boolean(provided && safeEqual(provided, token));
}

function responseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
  };
}

export async function GET(request: NextRequest) {
  const detailed = detailedAuthorized(request);
  const configurationProblems = getConfigurationProblems();

  if (configurationProblems.length > 0) {
    console.error(
      "Health configuration check failed:",
      configurationProblems.join("; "),
    );
    return NextResponse.json(
      {
        status: "error",
        checks: { configuration: "fail", database: "not-checked" },
        message:
          "Deployment configuration is incomplete. Run the Netlify preflight check and review the server log.",
        ...(detailed ? { configurationProblems } : {}),
      },
      { status: 503, headers: responseHeaders() },
    );
  }

  try {
    const handle = await getDbHandle();
    await handle.db.select({ id: plans.id }).from(plans).limit(1);
    return NextResponse.json(
      {
        status: "ok",
        checks: { configuration: "ok", database: "ok" },
        ...(detailed
          ? {
              details: {
                appEnv,
                isProduction,
                demoMode,
                mockCommerceAllowed,
                siteUrl,
                databaseDialect: handle.dialect,
                integrations: integrationModes,
                liveFlags: {
                  payments: flags.paymentsLive,
                  supplier: flags.supplierLive,
                  email: flags.emailLive,
                  catalogueSync: flags.catalogueSync,
                },
              },
            }
          : {}),
        note: "Health check only. This does not indicate production readiness.",
      },
      { status: 200, headers: responseHeaders() },
    );
  } catch (error) {
    console.error("Health check failed", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      {
        status: "error",
        checks: { configuration: "ok", database: "fail" },
        message: "Database check failed.",
        ...(detailed && error instanceof Error ? { databaseError: error.name } : {}),
      },
      { status: 503, headers: responseHeaders() },
    );
  }
}
