import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { mockCommerceAllowed } from "@/lib/config";
import { handlePaymentWebhook } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!mockCommerceAllowed) {
    // Do not reveal whether a mock webhook endpoint exists in production.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("x-mock-signature");
  try {
    const db = await getDb();
    const result = await handlePaymentWebhook(db, rawBody, signature);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      "Mock payment webhook rejected",
      error instanceof Error ? error.name : "unknown error",
    );
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
