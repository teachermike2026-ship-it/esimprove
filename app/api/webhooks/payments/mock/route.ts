import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { handlePaymentWebhook } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-mock-signature");
  try {
    const db = await getDb();
    const result = await handlePaymentWebhook(db, rawBody, signature);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
