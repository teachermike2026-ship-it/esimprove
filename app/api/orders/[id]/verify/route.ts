import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/config";
import { canViewOrder, getOrderById } from "@/lib/orders";
import { readBoundedText } from "@/lib/http/bounded-body";
import {
  checkRateLimit,
  checkRequestRateLimit,
  requestIpHash,
} from "@/lib/rate-limit";
import {
  getCryptoPaymentByOrderId,
  verifyCryptoPayment,
  CryptoPaymentNotFoundError,
} from "@/lib/payments/crypto/payment-service";
import { loadCryptoPaymentConfig } from "@/lib/payments/crypto/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const noStoreHeaders: Record<string, string> = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("host");
    const siteHost = new URL(siteUrl).host;
    return originHost === requestHost || originHost === siteHost;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const { id: orderId } = await context.params;
  if (!ORDER_ID_PATTERN.test(orderId)) {
    return json({ ok: false, error: "not_found" }, 404);
  }

  let body: unknown;
  try {
    const text = await readBoundedText(request, MAX_BODY_BYTES);
    if (text === null) return json({ ok: false, error: "payload_too_large" }, 413);
    body = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "invalid_payload" }, 400);
  }
  const input = body as { token?: unknown; txHash?: unknown };

  const token =
    typeof input.token === "string" && input.token.length > 0 && input.token.length <= 500
      ? input.token
      : null;
  let submittedTxHash: string | null = null;
  if (input.txHash !== undefined && input.txHash !== null && input.txHash !== "") {
    if (typeof input.txHash !== "string" || !TX_HASH_PATTERN.test(input.txHash.trim())) {
      return json({ ok: false, error: "invalid_tx_hash" }, 400);
    }
    submittedTxHash = input.txHash.trim();
  }

  const db = await getDb();

  // Per-IP limit first, then a stricter per-order + per-client limit so one
  // order cannot be used to exhaust the shared endpoint budget.
  try {
    const ipRate = await checkRequestRateLimit(db, "cryptoVerify", request.headers);
    if (!ipRate.allowed) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "Retry-After": "60",
          },
        },
      );
    }
    const orderRate = await checkRateLimit(
      db,
      `crypto:verify:order:${orderId}:${requestIpHash(request.headers)}`,
      12,
      60,
    );
    if (!orderRate.allowed) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "Retry-After": "60",
          },
        },
      );
    }
  } catch (error) {
    console.error(
      "Crypto verification rate limit failed",
      error instanceof Error ? error.name : "unknown error",
    );
    return json({ ok: false, error: "verification_unavailable" }, 503);
  }

  try {
    const order = await getOrderById(db, orderId);
    if (!order) return json({ ok: false, error: "not_found" }, 404);

    const user = await getCurrentUser();
    const allowed = await canViewOrder(db, order, {
      userId: user?.id ?? null,
      role: user?.role ?? null,
      token,
    });
    if (!allowed) return json({ ok: false, error: "not_found" }, 404);

    const cryptoPayment = await getCryptoPaymentByOrderId(db, order.id);
    if (!cryptoPayment) return json({ ok: false, error: "not_found" }, 404);

    const config = loadCryptoPaymentConfig();
    if (!config) {
      return json({ ok: false, error: "verification_unavailable" }, 503);
    }

    const result = await verifyCryptoPayment(db, cryptoPayment.id, {
      submittedTxHash,
      config,
      actor: "customer",
    });

    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof CryptoPaymentNotFoundError) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    console.error(
      "Crypto verification failed",
      error instanceof Error ? error.name : "unknown error",
    );
    return json({ ok: false, error: "verification_failed" }, 500);
  }
}

export function GET() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
