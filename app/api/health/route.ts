import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { plans } from "@/lib/db/schema";
import { appEnv, demoMode, flags, integrationModes, siteUrl } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.select({ id: plans.id }).from(plans).limit(1);
    return NextResponse.json({
      status: "ok",
      appEnv,
      demoMode,
      siteUrl,
      integrations: integrationModes,
      liveFlags: {
        payments: flags.paymentsLive,
        supplier: flags.supplierLive,
        email: flags.emailLive,
        catalogueSync: flags.catalogueSync,
      },
      note: "Health check only. This does not indicate production readiness.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 503 },
    );
  }
}
