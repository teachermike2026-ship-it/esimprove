import { and, desc, eq, gte, inArray, isNull, lte, ne, or } from "drizzle-orm";
import type { Database, DatabaseExecutor } from "@/lib/db/client";
import {
  cryptoPayments,
  orderEvents,
  orders,
  outboxEvents,
  paymentEvents,
  payments,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { runOutboxAndJobs } from "@/lib/fulfillment";
import {
  CRYPTO_PAYMENT_CONSTANTS,
  assertCryptoPaymentConfig,
  type CryptoPaymentConfig,
} from "@/lib/payments/crypto/config";
import {
  formatRawTokenAmount,
  generateCryptoPaymentReference,
  generatePaymentAmount,
  parseRawAmountFromDb,
  sameAddress,
} from "@/lib/payments/crypto/amount";
import {
  type ExplorerProvider,
  type TokenTransfer,
} from "@/lib/payments/crypto/explorer-provider";
import { RpcLogTransferProvider } from "@/lib/payments/crypto/rpc-log-provider";
import {
  FailoverBnbRpcClient,
  HttpBnbRpcClient,
  verifyBnbTransfer,
  type BscRpcClient,
} from "@/lib/payments/crypto/bnb-verifier";

/** Metadata key holding the last fully scanned BSC block for this payment. */
const SCAN_CURSOR_KEY = "scanCursorBlock";
/** Blocks re-scanned behind the cursor to tolerate short reorgs / lagging nodes. */
const SCAN_REORG_MARGIN_BLOCKS = 200;

export type CryptoPaymentStatus =
  | "pending"
  | "confirming"
  | "paid"
  | "expired"
  | "late_payment"
  | "manual_review"
  | "verification_error";

export type CryptoVerificationMessageCode =
  | "waiting_for_payment"
  | "payment_detected"
  | "confirming"
  | "paid"
  | "expired"
  | "late_payment"
  | "manual_review"
  | "verification_error"
  | "invalid_tx_hash"
  | "transaction_failed"
  | "amount_mismatch";

export type CryptoPaymentRow = typeof cryptoPayments.$inferSelect;
export type CryptoOrderRow = typeof orders.$inferSelect;

export interface CreateCryptoPaymentInput {
  orderId: string;
  amountMinor: number;
  currency: string;
  userId?: string | null;
}

export interface CreateCryptoPaymentResult {
  cryptoPaymentId: string;
  paymentId: string;
  reference: string;
  amountUsdt: string;
  expiresAt: Date;
  redirectUrl: string;
}

export function cryptoPaymentUrl(cryptoPaymentId: string, accessToken: string): string {
  return `/checkout/crypto/${encodeURIComponent(cryptoPaymentId)}?token=${encodeURIComponent(
    accessToken,
  )}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return /duplicate key|unique constraint|23505/i.test(String(error));
  }
  const candidate = error as { code?: unknown; message?: unknown; cause?: unknown };
  if (candidate.code === "23505") return true;
  if (
    typeof candidate.message === "string" &&
    /duplicate key value|unique constraint|23505/i.test(candidate.message)
  ) {
    return true;
  }
  return candidate.cause ? isUniqueViolation(candidate.cause) : false;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/apikey=[^\s&]+/gi, "apikey=[redacted]")
    .slice(0, 500);
}

function paymentExpiry(now: Date, config: CryptoPaymentConfig): Date {
  return new Date(now.getTime() + config.paymentWindowMinutes * 60 * 1000);
}

function result(
  payment: CryptoPaymentRow,
  config: CryptoPaymentConfig | null,
  now: Date,
  overrides: Partial<{
    status: CryptoPaymentStatus;
    messageCode: CryptoVerificationMessageCode;
    confirmations: number;
    txHash: string | null;
  }> = {},
): CryptoVerificationResult {
  const status = (overrides.status ?? payment.status) as CryptoPaymentStatus;
  const messageCode =
    overrides.messageCode ??
    (status === "paid"
      ? "paid"
      : status === "confirming"
        ? payment.confirmations > 0
          ? "confirming"
          : "payment_detected"
        : status === "expired"
          ? "expired"
          : status === "late_payment"
            ? "late_payment"
            : status === "manual_review"
              ? (payment.metadata ?? {}).amountMismatch
                ? "amount_mismatch"
                : "manual_review"
              : status === "verification_error"
                ? "verification_error"
                : "waiting_for_payment");
  return {
    status,
    messageCode,
    confirmations: overrides.confirmations ?? payment.confirmations,
    requiredConfirmations:
      config?.confirmationsRequired ?? CRYPTO_PAYMENT_CONSTANTS.confirmationsRequired,
    txHash: overrides.txHash === undefined ? payment.txHash : overrides.txHash,
    amountUsdt: payment.amountUsdt,
    amountRaw: parseRawAmountFromDb(payment.amountRaw).toString(),
    reference: payment.reference,
    expiresAt: payment.expiresAt.toISOString(),
    serverNow: now.toISOString(),
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  };
}

export interface CryptoVerificationResult {
  status: CryptoPaymentStatus;
  messageCode: CryptoVerificationMessageCode;
  confirmations: number;
  requiredConfirmations: number;
  txHash: string | null;
  amountUsdt: string;
  amountRaw: string;
  reference: string;
  expiresAt: string;
  serverNow: string;
  paidAt: string | null;
}

/**
 * Reserve a unique payable amount and create both the generic payment row and
 * the crypto-specific payment row. The unique index on amount_raw is the
 * concurrency control; a collision retries with a new cryptographic suffix.
 */
export async function createCryptoPayment(
  db: Database,
  input: CreateCryptoPaymentInput,
  options: { config?: CryptoPaymentConfig; now?: Date } = {},
): Promise<CreateCryptoPaymentResult> {
  const config = options.config ?? assertCryptoPaymentConfig();
  const now = options.now ?? new Date();
  const existing = await getCryptoPaymentByOrderId(db, input.orderId);
  if (existing) {
    return {
      cryptoPaymentId: existing.id,
      paymentId: existing.paymentId,
      reference: existing.reference,
      amountUsdt: existing.amountUsdt,
      expiresAt: existing.expiresAt,
      redirectUrl: `/checkout/crypto/${existing.id}`,
    };
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const generated = generatePaymentAmount(input.amountMinor, input.currency);
    const cryptoPaymentId = newId("cryptopay");
    const paymentId = newId("pay");
    const reference = generateCryptoPaymentReference();
    const expiresAt = paymentExpiry(now, config);
    try {
      await db.transaction(async (tx) => {
        await tx.insert(payments).values({
          id: paymentId,
          orderId: input.orderId,
          provider: "crypto",
          providerPaymentId: reference,
          status: "pending",
          amountMinor: input.amountMinor,
          currency: input.currency,
          checkoutUrl: `/checkout/crypto/${cryptoPaymentId}`,
        });
        await tx.insert(cryptoPayments).values({
          id: cryptoPaymentId,
          paymentId,
          orderId: input.orderId,
          reference,
          userId: input.userId ?? null,
          paymentMethod: "crypto",
          paymentAsset: config.asset,
          chainId: config.chainId,
          tokenContract: config.tokenContract,
          receivingAddress: config.wallet,
          amountRaw: generated.amountRawString,
          amountUsdt: generated.amountUsdt,
          originalAmountMinor: input.amountMinor,
          originalCurrency: input.currency,
          status: "pending",
          // Store the same instant used for expiry so the window is exactly
          // paymentWindowMinutes, not a few milliseconds short due to the
          // database default timestamp.
          createdAt: now,
          expiresAt,
          metadata: {
            suffix: generated.suffix,
            network: config.network,
            standard: config.standard,
            confirmationsRequired: config.confirmationsRequired,
          },
        });
        await tx.insert(paymentEvents).values({
          id: newId("payevent"),
          paymentId,
          eventType: "crypto.payment.created",
          payload: {
            cryptoPaymentId,
            reference,
            amountRaw: generated.amountRawString,
            amountUsdt: generated.amountUsdt,
            chainId: config.chainId,
            tokenContract: config.tokenContract,
            expiresAt: expiresAt.toISOString(),
          },
          status: "pending",
        });
        await tx.insert(orderEvents).values({
          id: newId("orderevent"),
          orderId: input.orderId,
          type: "crypto.payment.created",
          message: "Crypto payment request created. Waiting for the exact Binance-Peg USDT amount.",
          metadata: {
            reference,
            amountRaw: generated.amountRawString,
            amountUsdt: generated.amountUsdt,
            chainId: config.chainId,
            expiresAt: expiresAt.toISOString(),
          },
        });
      });
      await recordAudit(db, {
        actorType: input.userId ? "user" : "guest",
        actorId: input.userId ?? null,
        action: "crypto.payment.created",
        entityType: "crypto_payment",
        entityId: cryptoPaymentId,
        metadata: { orderId: input.orderId, reference, amountUsdt: generated.amountUsdt },
      });
      return {
        cryptoPaymentId,
        paymentId,
        reference,
        amountUsdt: generated.amountUsdt,
        expiresAt,
        redirectUrl: `/checkout/crypto/${cryptoPaymentId}`,
      };
    } catch (error) {
      lastError = error;
      if (!isUniqueViolation(error)) throw error;
      // A concurrent request for the same order may have committed first.
      // Return that request instead of creating a second payable amount.
      const concurrent = await getCryptoPaymentByOrderId(db, input.orderId);
      if (concurrent) {
        return {
          cryptoPaymentId: concurrent.id,
          paymentId: concurrent.paymentId,
          reference: concurrent.reference,
          amountUsdt: concurrent.amountUsdt,
          expiresAt: concurrent.expiresAt,
          redirectUrl: `/checkout/crypto/${concurrent.id}`,
        };
      }
    }
  }
  throw new Error(
    `Could not reserve a unique crypto payment amount after repeated attempts${
      lastError ? `: ${safeErrorMessage(lastError)}` : ""
    }`,
  );
}

export async function getCryptoPaymentById(
  db: DatabaseExecutor,
  cryptoPaymentId: string,
): Promise<CryptoPaymentRow | null> {
  const rows = await db
    .select()
    .from(cryptoPayments)
    .where(eq(cryptoPayments.id, cryptoPaymentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCryptoPaymentByOrderId(
  db: DatabaseExecutor,
  orderId: string,
): Promise<CryptoPaymentRow | null> {
  const rows = await db
    .select()
    .from(cryptoPayments)
    .where(eq(cryptoPayments.orderId, orderId))
    .orderBy(desc(cryptoPayments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

const ACTIVE_STATUSES: CryptoPaymentStatus[] = [
  "pending",
  "confirming",
  "verification_error",
];
async function insertPaymentEvent(
  db: DatabaseExecutor,
  paymentId: string,
  eventType: string,
  status: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(paymentEvents).values({
    id: newId("payevent"),
    paymentId,
    eventType,
    payload,
    status,
  });
}

async function insertOrderEvent(
  db: DatabaseExecutor,
  orderId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await db.insert(orderEvents).values({
    id: newId("orderevent"),
    orderId,
    type,
    message,
    metadata,
  });
}

async function markVerificationError(
  db: Database,
  payment: CryptoPaymentRow,
  error: unknown,
  now: Date,
): Promise<CryptoVerificationResult> {
  const message = safeErrorMessage(error);
  const nextStatus: CryptoPaymentStatus =
    payment.status === "confirming" || payment.status === "expired"
      ? payment.status
      : "verification_error";
  await db
    .update(cryptoPayments)
    .set({
      status: nextStatus,
      lastError: message,
      lastVerifiedAt: now,
      verificationAttempts: payment.verificationAttempts + 1,
      updatedAt: now,
    })
    .where(eq(cryptoPayments.id, payment.id));
  await insertPaymentEvent(db, payment.paymentId, "crypto.verification.error", nextStatus, {
    cryptoPaymentId: payment.id,
    error: message,
  });
  if (payment.status !== nextStatus) {
    await insertOrderEvent(
      db,
      payment.orderId,
      "crypto.verification.error",
      "The blockchain payment check could not complete. No payment status was changed.",
      { cryptoPaymentId: payment.id },
    );
  }
  return result(
    { ...payment, status: nextStatus, lastError: message, lastVerifiedAt: now },
    null,
    now,
    { status: nextStatus, messageCode: "verification_error" },
  );
}

async function markManualReview(
  db: Database,
  payment: CryptoPaymentRow,
  reason: string,
  now: Date,
  details: Partial<CryptoPaymentRow> = {},
): Promise<CryptoVerificationResult> {
  const metadata = {
    ...(payment.metadata ?? {}),
    manualReviewReason: reason,
  };
  const updated = await db
    .update(cryptoPayments)
    .set({
      status: "manual_review",
      lastError: reason,
      lastVerifiedAt: now,
      verificationAttempts: payment.verificationAttempts + 1,
      updatedAt: now,
      metadata,
      ...details,
    })
    .where(
      and(
        eq(cryptoPayments.id, payment.id),
        inArray(cryptoPayments.status, ["pending", "confirming", "expired", "verification_error"]),
      ),
    )
    .returning();
  const current = updated[0] ?? { ...payment, status: "manual_review" as const, metadata };
  await insertPaymentEvent(db, payment.paymentId, "crypto.payment.manual_review", "manual_review", {
    cryptoPaymentId: payment.id,
    reason,
    txHash: current.txHash,
  });
  await insertOrderEvent(
    db,
    payment.orderId,
    "crypto.payment.manual_review",
    "A crypto payment requires manual verification. Support has been notified.",
    { cryptoPaymentId: payment.id, reason },
  );
  await recordAudit(db, {
    actorType: "system",
    action: "crypto.payment.manual_review",
    entityType: "crypto_payment",
    entityId: payment.id,
    metadata: { orderId: payment.orderId, reason, txHash: current.txHash },
  });
  return result(current, null, now, { status: "manual_review" });
}

/** Tolerance for treating a transfer as a wrong amount for one specific order. */
function amountMismatchTolerance(expected: bigint): bigint {
  const oneUsdt = 10n ** 18n;
  const tenPercent = expected / 10n;
  return tenPercent > oneUsdt ? tenPercent : oneUsdt;
}

/**
 * Policy for transfers that reach the receiving wallet with an amount that
 * does not exactly equal any reserved order amount (for example the customer
 * rounded 28.5817 to 28.58, or sent too much):
 * - never credited automatically;
 * - if the transfer is close to exactly ONE reserved order (within
 *   max(1 USDT, 10%)), arrived after that order was created, and its hash is
 *   not assigned elsewhere, that order goes to manual review with the
 *   received and expected amounts recorded, so support can refund the
 *   difference or ask for the remainder;
 * - if it is close to several orders, nothing is guessed (the transfer stays
 *   unassigned for reconciliation).
 */
async function findAmountMismatch(
  db: Database,
  payment: CryptoPaymentRow,
  expected: bigint,
  transfers: TokenTransfer[],
): Promise<{ txHash: string; receivedRaw: bigint } | null> {
  if (transfers.length === 0) return null;
  const reserved = await db
    .select({ id: cryptoPayments.id, amountRaw: cryptoPayments.amountRaw })
    .from(cryptoPayments)
    .where(isNull(cryptoPayments.amountReleasedAt));
  for (const transfer of transfers) {
    if (transfer.timestamp.getTime() < payment.createdAt.getTime()) continue;
    if (await txHashClaimedByAnother(db, payment.id, transfer.hash)) continue;
    const value = BigInt(transfer.valueRaw);
    if (value <= 0n) continue;
    const exactOther = reserved.some(
      (row) => row.id !== payment.id && parseRawAmountFromDb(row.amountRaw) === value,
    );
    if (exactOther) continue;
    const near = reserved.filter((row) => {
      const amount = parseRawAmountFromDb(row.amountRaw);
      const diff = amount > value ? amount - value : value - amount;
      return diff <= amountMismatchTolerance(amount);
    });
    if (near.length === 1 && near[0]!.id === payment.id && value !== expected) {
      return { txHash: transfer.hash, receivedRaw: value };
    }
  }
  return null;
}

async function persistConfirming(
  db: Database,
  payment: CryptoPaymentRow,
  settlement: {
    txHash: string;
    fromAddress: string;
    blockNumber: number;
    confirmations: number;
    blockTime: Date;
  },
  now: Date,
): Promise<CryptoVerificationResult> {
  const metadata = {
    ...(payment.metadata ?? {}),
    blockTime: settlement.blockTime.toISOString(),
  };
  const updated = await db
    .update(cryptoPayments)
    .set({
      status: "confirming",
      txHash: settlement.txHash,
      fromAddress: settlement.fromAddress,
      blockNumber: settlement.blockNumber,
      confirmations: settlement.confirmations,
      detectedAt: payment.detectedAt ?? now,
      lastVerifiedAt: now,
      lastError: null,
      verificationAttempts: payment.verificationAttempts + 1,
      updatedAt: now,
      metadata,
    })
    .where(
      and(
        eq(cryptoPayments.id, payment.id),
        inArray(cryptoPayments.status, ["pending", "confirming", "verification_error", "expired"]),
        or(isNull(cryptoPayments.txHash), eq(cryptoPayments.txHash, settlement.txHash)),
      ),
    )
    .returning();
  const current = updated[0];
  if (!current) {
    const latest = await getCryptoPaymentById(db, payment.id);
    return result(latest ?? payment, null, now);
  }
  await insertPaymentEvent(db, payment.paymentId, "crypto.payment.confirming", "pending", {
    cryptoPaymentId: payment.id,
    txHash: settlement.txHash,
    blockNumber: settlement.blockNumber,
    confirmations: settlement.confirmations,
    requiredConfirmations: payment.metadata?.confirmationsRequired,
  });
  if (payment.status !== "confirming") {
    await insertOrderEvent(
      db,
      payment.orderId,
      "crypto.payment.confirming",
      "Crypto payment detected. Waiting for blockchain confirmations.",
      {
        cryptoPaymentId: payment.id,
        txHash: settlement.txHash,
        confirmations: settlement.confirmations,
      },
    );
  }
  return result(current, null, now, {
    status: "confirming",
    messageCode: "confirming",
    confirmations: settlement.confirmations,
    txHash: settlement.txHash,
  });
}

async function markLatePayment(
  db: Database,
  payment: CryptoPaymentRow,
  settlement: {
    txHash: string;
    fromAddress: string;
    blockNumber: number;
    confirmations: number;
    blockTime: Date;
  },
  now: Date,
): Promise<CryptoVerificationResult> {
  const metadata = {
    ...(payment.metadata ?? {}),
    blockTime: settlement.blockTime.toISOString(),
    lateBySeconds: Math.max(
      0,
      Math.floor((settlement.blockTime.getTime() - payment.expiresAt.getTime()) / 1000),
    ),
  };
  const updated = await db
    .update(cryptoPayments)
    .set({
      status: "late_payment",
      txHash: settlement.txHash,
      fromAddress: settlement.fromAddress,
      blockNumber: settlement.blockNumber,
      confirmations: settlement.confirmations,
      detectedAt: payment.detectedAt ?? now,
      lastVerifiedAt: now,
      lastError: "Transfer arrived after the payment request expired",
      verificationAttempts: payment.verificationAttempts + 1,
      updatedAt: now,
      metadata,
    })
    .where(
      and(
        eq(cryptoPayments.id, payment.id),
        inArray(cryptoPayments.status, ["pending", "confirming", "expired", "verification_error"]),
        or(isNull(cryptoPayments.txHash), eq(cryptoPayments.txHash, settlement.txHash)),
      ),
    )
    .returning();
  const current = updated[0] ?? payment;
  await insertPaymentEvent(db, payment.paymentId, "crypto.payment.late", "late_payment", {
    cryptoPaymentId: payment.id,
    txHash: settlement.txHash,
    blockNumber: settlement.blockNumber,
    confirmations: settlement.confirmations,
  });
  await insertOrderEvent(
    db,
    payment.orderId,
    "crypto.payment.late",
    "A late crypto transfer was detected. The order is not fulfilled automatically; support review is required.",
    {
      cryptoPaymentId: payment.id,
      txHash: settlement.txHash,
      amountUsdt: payment.amountUsdt,
    },
  );
  await recordAudit(db, {
    actorType: "system",
    action: "crypto.payment.late",
    entityType: "crypto_payment",
    entityId: payment.id,
    metadata: {
      orderId: payment.orderId,
      txHash: settlement.txHash,
      amountRaw: parseRawAmountFromDb(payment.amountRaw).toString(),
    },
  });
  return result(current, null, now, {
    status: "late_payment",
    messageCode: "late_payment",
    confirmations: settlement.confirmations,
    txHash: settlement.txHash,
  });
}

async function markPaid(
  db: Database,
  payment: CryptoPaymentRow,
  settlement: {
    txHash: string;
    fromAddress: string;
    blockNumber: number;
    confirmations: number;
    blockTime: Date;
  },
  now: Date,
  actor: "customer" | "worker",
): Promise<{ result: CryptoVerificationResult; newlyPaid: boolean }> {
  const metadata = {
    ...(payment.metadata ?? {}),
    blockTime: settlement.blockTime.toISOString(),
    verifiedBy: "bnb-rpc",
  };

  let newlyPaid = false;
  let conflict = false;
  let current: CryptoPaymentRow | null = null;

  try {
    await db.transaction(async (tx) => {
      const owner = await tx
        .select({ id: cryptoPayments.id })
        .from(cryptoPayments)
        .where(eq(cryptoPayments.txHash, settlement.txHash))
        .limit(1);
      if (owner[0] && owner[0].id !== payment.id) {
        conflict = true;
        return;
      }

      const updated = await tx
        .update(cryptoPayments)
        .set({
          status: "paid",
          txHash: settlement.txHash,
          fromAddress: settlement.fromAddress,
          blockNumber: settlement.blockNumber,
          confirmations: settlement.confirmations,
          paidAt: now,
          detectedAt: payment.detectedAt ?? now,
          lastVerifiedAt: now,
          lastError: null,
          verificationAttempts: payment.verificationAttempts + 1,
          updatedAt: now,
          metadata,
        })
        .where(
          and(
            eq(cryptoPayments.id, payment.id),
            inArray(cryptoPayments.status, ["pending", "confirming", "expired", "verification_error"]),
            or(isNull(cryptoPayments.txHash), eq(cryptoPayments.txHash, settlement.txHash)),
          ),
        )
        .returning();
      current = updated[0] ?? null;

      if (!current) {
        const latest = await tx
          .select()
          .from(cryptoPayments)
          .where(eq(cryptoPayments.id, payment.id))
          .limit(1);
        current = latest[0] ?? null;
        if (current?.status === "paid" && current.txHash === settlement.txHash) {
          newlyPaid = false;
        }
        return;
      }

      newlyPaid = true;
      await tx
        .update(payments)
        .set({ status: "paid", updatedAt: now })
        .where(eq(payments.id, payment.paymentId));
      const orderState = await tx
        .select({ paymentStatus: orders.paymentStatus })
        .from(orders)
        .where(eq(orders.id, payment.orderId))
        .limit(1);
      if (orderState[0]?.paymentStatus === "paid") {
        // Already paid by card: keep the transfer recorded for a manual
        // refund, but do not reset the order or queue fulfillment again.
        await insertOrderEvent(
          tx,
          payment.orderId,
          "payment.duplicate",
          "A crypto payment was confirmed for an order that was already paid. Manual refund review is required.",
          { cryptoPaymentId: payment.id, txHash: settlement.txHash, amountUsdt: payment.amountUsdt },
        );
        return;
      }
      await tx
        .update(orders)
        .set({
          paymentStatus: "paid",
          status: "processing",
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(orders.id, payment.orderId));
      await insertPaymentEvent(
        tx,
        payment.paymentId,
        "crypto.payment.confirmed",
        "paid",
        {
          cryptoPaymentId: payment.id,
          txHash: settlement.txHash,
          blockNumber: settlement.blockNumber,
          confirmations: settlement.confirmations,
          amountRaw: parseRawAmountFromDb(payment.amountRaw).toString(),
          amountUsdt: payment.amountUsdt,
        },
      );
      await insertOrderEvent(
        tx,
        payment.orderId,
        "crypto.payment.confirmed",
        "Crypto payment confirmed on BNB Smart Chain. Fulfillment is queued.",
        {
          cryptoPaymentId: payment.id,
          txHash: settlement.txHash,
          amountUsdt: payment.amountUsdt,
        },
      );
      await tx.insert(outboxEvents).values({
        id: newId("outbox"),
        topic: "fulfillment.requested",
        aggregateType: "order",
        aggregateId: payment.orderId,
        payload: { orderId: payment.orderId, cryptoPaymentId: payment.id },
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    conflict = true;
  }

  if (conflict) {
    // Do not assign a transaction hash that belongs to another order: the
    // unique index would reject it and the second order must stay in review.
    return {
      result: await markManualReview(
        db,
        payment,
        "The transaction hash is already assigned to another order",
        now,
      ),
      newlyPaid: false,
    };
  }

  const settled = current ?? { ...payment, status: "paid" as const, txHash: settlement.txHash };
  if (newlyPaid) {
    await recordAudit(db, {
      actorType: actor === "worker" ? "system" : "user",
      actorId: payment.userId ?? null,
      action: "crypto.payment.confirmed",
      entityType: "crypto_payment",
      entityId: payment.id,
      metadata: {
        orderId: payment.orderId,
        txHash: settlement.txHash,
        confirmations: settlement.confirmations,
        amountRaw: parseRawAmountFromDb(payment.amountRaw).toString(),
      },
    });
    try {
      await runOutboxAndJobs(db);
    } catch (error) {
      // The outbox row is committed. The scheduled worker will retry
      // fulfillment; the payment must stay paid.
      console.error(
        "Crypto payment confirmed but fulfillment dispatch failed",
        safeErrorMessage(error),
      );
    }
  }

  const settledStatus = settled.status as CryptoPaymentStatus;
  return {
    result: result(settled, null, now, {
      status: settledStatus,
      messageCode: settledStatus === "paid" ? "paid" : undefined,
      confirmations: settlement.confirmations,
      txHash: settlement.txHash,
    }),
    newlyPaid,
  };
}

export interface VerifyCryptoPaymentOptions {
  submittedTxHash?: string | null;
  config?: CryptoPaymentConfig;
  explorer?: ExplorerProvider;
  rpc?: BscRpcClient;
  now?: Date;
  actor?: "customer" | "worker";
}

export class CryptoPaymentNotFoundError extends Error {
  constructor() {
    super("Crypto payment not found");
    this.name = "CryptoPaymentNotFoundError";
  }
}

/**
 * Perform one complete verification pass. Network failures return
 * `verification_error` and never promote or expire a payment.
 */
/** How long one verification pass may hold a payment before another may start. */
const VERIFICATION_LEASE_MS = 30_000;

export async function verifyCryptoPayment(
  db: Database,
  cryptoPaymentId: string,
  options: VerifyCryptoPaymentOptions = {},
): Promise<CryptoVerificationResult> {
  const config = options.config ?? assertCryptoPaymentConfig();
  const now = options.now ?? new Date();
  const payment = await getCryptoPaymentById(db, cryptoPaymentId);
  if (!payment) throw new CryptoPaymentNotFoundError();
  if (payment.status === "paid" || payment.status === "late_payment" || payment.status === "manual_review") {
    return result(payment, config, now);
  }

  // Single-flight: browser polling, "check now" and the worker may run at the
  // same time. Only the holder of the lease scans the chain; others return the
  // last saved state. (Correctness never depends on this: the paid transition
  // and tx-hash uniqueness are enforced in the database.)
  const claimed = await db
    .update(cryptoPayments)
    .set({ verificationLeaseUntil: new Date(Date.now() + VERIFICATION_LEASE_MS) })
    .where(
      and(
        eq(cryptoPayments.id, payment.id),
        or(
          isNull(cryptoPayments.verificationLeaseUntil),
          lte(cryptoPayments.verificationLeaseUntil, new Date()),
        ),
      ),
    )
    .returning({ id: cryptoPayments.id });
  if (claimed.length === 0) {
    return result(payment, config, now);
  }
  try {
    return await verifyCryptoPaymentLocked(db, cryptoPaymentId, { ...options, config, now });
  } finally {
    await db
      .update(cryptoPayments)
      .set({ verificationLeaseUntil: null })
      .where(eq(cryptoPayments.id, payment.id));
  }
}

async function verifyCryptoPaymentLocked(
  db: Database,
  cryptoPaymentId: string,
  options: VerifyCryptoPaymentOptions & { config: CryptoPaymentConfig; now: Date },
): Promise<CryptoVerificationResult> {
  const config = options.config;
  const now = options.now;
  const payment = await getCryptoPaymentById(db, cryptoPaymentId);
  if (!payment) throw new CryptoPaymentNotFoundError();

  if (payment.status === "paid" || payment.status === "late_payment" || payment.status === "manual_review") {
    return result(payment, config, now);
  }

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);
  const order = orderRows[0];
  if (!order) throw new Error("Crypto payment references an unknown order");

  const rpc =
    options.rpc ??
    (config.rpcFallbackUrl
      ? new FailoverBnbRpcClient([
          new HttpBnbRpcClient({ url: config.rpcUrl }),
          new HttpBnbRpcClient({ url: config.rpcFallbackUrl }),
        ])
      : new HttpBnbRpcClient({ url: config.rpcUrl }));
  const explorer =
    options.explorer ??
    new RpcLogTransferProvider({
      rpcUrl: config.rpcUrl,
      wallet: config.wallet,
      tokenContract: config.tokenContract,
    });

  const amountRaw = parseRawAmountFromDb(payment.amountRaw);
  const amountRawString = amountRaw.toString();
  const submittedTxHash =
    options.submittedTxHash && /^0x[0-9a-fA-F]{64}$/.test(options.submittedTxHash)
      ? options.submittedTxHash
      : null;

  // If a transaction is already assigned, re-verify it directly. Explorer
  // discovery is not needed and an explorer outage must not erase progress.
  if (payment.txHash) {
    return verifyKnownTransaction(db, payment, order, config, rpc, now, options.actor);
  }

  const candidateHashes = new Set<string>();
  if (submittedTxHash) candidateHashes.add(submittedTxHash);

  let scanTruncated = false;
  let explorerCandidate = false;
  const wrongAmountTransfers: TokenTransfer[] = [];
  // A customer-supplied hash can be verified directly against BNB RPC. The
  // explorer is discovery only, so an explorer outage must not block this
  // fallback. Without a supplied hash, discovery is required.
  if (!submittedTxHash) {
    try {
      const cursor = (payment.metadata ?? {})[SCAN_CURSOR_KEY];
      const scan = await explorer.findTokenTransfers({
        since: new Date(
          Math.min(payment.createdAt.getTime(), order.createdAt.getTime()) - 2 * 60 * 1000,
        ),
        until: now,
        // Resume from the last scanned block (minus a reorg margin) so the
        // worker does not rescan the whole window every minute.
        fromBlock:
          typeof cursor === "number" && Number.isSafeInteger(cursor)
            ? Math.max(0, cursor - SCAN_REORG_MARGIN_BLOCKS)
            : undefined,
      });
      scanTruncated = scan.truncated;
      if (scan.scannedToBlock !== undefined && scan.scannedToBlock >= 0) {
        const metadata = { ...(payment.metadata ?? {}), [SCAN_CURSOR_KEY]: scan.scannedToBlock };
        await db
          .update(cryptoPayments)
          .set({ metadata })
          .where(eq(cryptoPayments.id, payment.id));
        payment.metadata = metadata;
      }
      for (const transfer of scan.transfers) {
        if (!sameAddress(transfer.to, config.wallet)) continue;
        if (!sameAddress(transfer.contractAddress, config.tokenContract)) continue;
        if (transfer.valueRaw !== amountRawString) {
          wrongAmountTransfers.push(transfer);
          continue;
        }
        candidateHashes.add(transfer.hash);
        explorerCandidate = true;
      }
    } catch (error) {
      return markVerificationError(db, payment, error, now);
    }
  }

  if (scanTruncated && candidateHashes.size === 0) {
    return markVerificationError(
      db,
      payment,
      new Error("Explorer scan reached its safety page limit; payment cannot be ruled out"),
      now,
    );
  }

  if (candidateHashes.size === 0 && wrongAmountTransfers.length > 0) {
    const mismatch = await findAmountMismatch(db, payment, amountRaw, wrongAmountTransfers);
    if (mismatch) {
      const kind = mismatch.receivedRaw < amountRaw ? "Underpaid" : "Overpaid";
      const reason = `${kind}: received ${formatRawTokenAmount(mismatch.receivedRaw)} USDT, expected ${formatRawTokenAmount(amountRaw)} USDT (transaction ${mismatch.txHash})`;
      return markManualReview(db, payment, reason, now, {
        metadata: {
          ...(payment.metadata ?? {}),
          manualReviewReason: reason,
          amountMismatch: {
            kind: kind.toLowerCase(),
            txHash: mismatch.txHash,
            receivedRaw: mismatch.receivedRaw.toString(),
            expectedRaw: amountRaw.toString(),
          },
        },
      });
    }
  }

  if (candidateHashes.size === 0) {
    if (payment.expiresAt.getTime() <= now.getTime()) {
      const updated = await db
        .update(cryptoPayments)
        .set({
          status: "expired",
          lastVerifiedAt: now,
          verificationAttempts: payment.verificationAttempts + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(cryptoPayments.id, payment.id),
            inArray(cryptoPayments.status, ["pending", "verification_error"]),
          ),
        )
        .returning();
      const current = updated[0] ?? payment;
      if (updated[0]) {
        await insertPaymentEvent(db, payment.paymentId, "crypto.payment.expired", "expired", {
          cryptoPaymentId: payment.id,
          expiresAt: payment.expiresAt.toISOString(),
        });
        await insertOrderEvent(
          db,
          payment.orderId,
          "crypto.payment.expired",
          "The crypto payment request expired without a matching transfer.",
          { cryptoPaymentId: payment.id },
        );
        await recordAudit(db, {
          actorType: "system",
          action: "crypto.payment.expired",
          entityType: "crypto_payment",
          entityId: payment.id,
          metadata: { orderId: payment.orderId },
        });
      }
      return result(current, config, now, {
        status: "expired",
        messageCode: "expired",
      });
    }
    await db
      .update(cryptoPayments)
      .set({
        status: "pending",
        lastVerifiedAt: now,
        lastError: null,
        verificationAttempts: payment.verificationAttempts + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(cryptoPayments.id, payment.id),
          inArray(cryptoPayments.status, ["pending", "verification_error"]),
        ),
      );
    await insertPaymentEvent(db, payment.paymentId, "crypto.verification.waiting", "pending", {
      cryptoPaymentId: payment.id,
      scanTruncated,
    });
    return result({ ...payment, status: "pending", lastVerifiedAt: now }, config, now, {
      status: "pending",
      messageCode: "waiting_for_payment",
    });
  }

  if (candidateHashes.size > 1) {
    return markManualReview(
      db,
      payment,
      "Multiple transactions match the exact reserved payment amount",
      now,
    );
  }

  const candidateHash = [...candidateHashes][0]!;
  let verification;
  try {
    verification = await verifyBnbTransfer(rpc, candidateHash, {
      tokenContract: config.tokenContract,
      wallet: config.wallet,
      amountRaw,
      requiredConfirmations: config.confirmationsRequired,
      expectedChainId: config.chainId,
    });
  } catch (error) {
    return markVerificationError(db, payment, error, now);
  }

  if (verification.outcome === "rejected") {
    if (verification.reason === "wrong_network") {
      return markVerificationError(db, payment, new Error("RPC network is not chain 56"), now);
    }
    if (
      verification.reason === "transaction_not_found" ||
      verification.reason === "receipt_pending"
    ) {
      if (payment.expiresAt.getTime() <= now.getTime()) {
        return verifyExpiredNoCandidate(db, payment, config, now);
      }
      await insertPaymentEvent(db, payment.paymentId, "crypto.verification.pending", "pending", {
        cryptoPaymentId: payment.id,
        txHash: candidateHash,
        reason: verification.reason,
      });
      return result(payment, config, now);
    }
    if (verification.reason === "failed_receipt") {
      await insertPaymentEvent(db, payment.paymentId, "crypto.verification.failed_receipt", "pending", {
        cryptoPaymentId: payment.id,
        txHash: candidateHash,
      });
      return result(payment, config, now, {
        messageCode: "transaction_failed",
        txHash: candidateHash,
      });
    }
    if (
      !explorerCandidate &&
      (verification.reason === "no_matching_transfer" ||
        verification.reason === "ambiguous_transfer")
    ) {
      await insertPaymentEvent(
        db,
        payment.paymentId,
        "crypto.verification.hash_mismatch",
        "pending",
        {
          cryptoPaymentId: payment.id,
          txHash: candidateHash,
          reason: verification.reason,
        },
      );
      return result(payment, config, now, {
        messageCode: "transaction_failed",
        txHash: candidateHash,
      });
    }
    return markVerificationError(
      db,
      payment,
      new Error(`Independent RPC verification rejected the transfer: ${verification.reason}`),
      now,
    );
  }

  const settlement = {
    txHash: verification.outcome === "verified"
      ? verification.settlement.txHash
      : verification.txHash,
    fromAddress:
      verification.outcome === "verified"
        ? verification.settlement.fromAddress
        : verification.fromAddress,
    blockNumber:
      verification.outcome === "verified"
        ? verification.settlement.blockNumber
        : verification.blockNumber,
    confirmations:
      verification.outcome === "verified"
        ? verification.settlement.confirmations
        : verification.confirmations,
    blockTime:
      verification.outcome === "verified" ? verification.settlement.blockTime : verification.blockTime,
  };

  if (await txHashClaimedByAnother(db, payment.id, settlement.txHash)) {
    return markManualReview(
      db,
      payment,
      "The transaction hash is already assigned to another order",
      now,
    );
  }

  if (settlement.blockTime.getTime() < order.createdAt.getTime()) {
    return markManualReview(
      db,
      payment,
      "Transaction block timestamp is before the order was created",
      now,
      { txHash: settlement.txHash },
    );
  }

  if (settlement.blockTime.getTime() > payment.expiresAt.getTime()) {
    return markLatePayment(db, payment, settlement, now);
  }

  if (verification.outcome === "confirming") {
    return persistConfirming(db, payment, settlement, now);
  }

  const paid = await markPaid(db, payment, settlement, now, options.actor ?? "customer");
  return paid.result;
}

async function txHashClaimedByAnother(
  db: Database,
  cryptoPaymentId: string,
  txHash: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: cryptoPayments.id })
    .from(cryptoPayments)
    .where(
      and(eq(cryptoPayments.txHash, txHash), ne(cryptoPayments.id, cryptoPaymentId)),
    )
    .limit(1);
  return rows.length > 0;
}

async function verifyExpiredNoCandidate(
  db: Database,
  payment: CryptoPaymentRow,
  config: CryptoPaymentConfig,
  now: Date,
): Promise<CryptoVerificationResult> {
  const updated = await db
    .update(cryptoPayments)
    .set({
      status: "expired",
      lastVerifiedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(cryptoPayments.id, payment.id),
        inArray(cryptoPayments.status, ["pending", "verification_error"]),
      ),
    )
    .returning();
  return result(updated[0] ?? { ...payment, status: "expired" }, config, now, {
    status: "expired",
    messageCode: "expired",
  });
}

async function verifyKnownTransaction(
  db: Database,
  payment: CryptoPaymentRow,
  order: CryptoOrderRow,
  config: CryptoPaymentConfig,
  rpc: BscRpcClient,
  now: Date,
  actor: "customer" | "worker" = "customer",
): Promise<CryptoVerificationResult> {
  const amountRaw = parseRawAmountFromDb(payment.amountRaw);
  let verification;
  try {
    verification = await verifyBnbTransfer(rpc, payment.txHash!, {
      tokenContract: config.tokenContract,
      wallet: config.wallet,
      amountRaw,
      requiredConfirmations: config.confirmationsRequired,
      expectedChainId: config.chainId,
    });
  } catch (error) {
    return markVerificationError(db, payment, error, now);
  }

  if (verification.outcome === "rejected") {
    if (verification.reason === "wrong_network") {
      return markVerificationError(db, payment, new Error("RPC network is not chain 56"), now);
    }
    if (verification.reason === "transaction_not_found" || verification.reason === "receipt_pending") {
      return result(payment, config, now, { messageCode: "confirming" });
    }
    if (verification.reason === "failed_receipt") {
      return markManualReview(db, payment, "Assigned transaction receipt failed", now);
    }
    return markManualReview(
      db,
      payment,
      `Assigned transaction no longer contains the expected transfer (${verification.reason})`,
      now,
    );
  }

  const settlement =
    verification.outcome === "verified"
      ? verification.settlement
      : {
          txHash: verification.txHash,
          fromAddress: verification.fromAddress,
          blockNumber: verification.blockNumber,
          confirmations: verification.confirmations,
          blockTime: verification.blockTime,
        };

  if (settlement.blockTime.getTime() < order.createdAt.getTime()) {
    return markManualReview(
      db,
      payment,
      "Transaction block timestamp is before the order was created",
      now,
      { txHash: settlement.txHash },
    );
  }
  if (settlement.blockTime.getTime() > payment.expiresAt.getTime()) {
    return markLatePayment(db, payment, settlement, now);
  }
  if (verification.outcome === "confirming") {
    return persistConfirming(db, payment, settlement, now);
  }
  const paid = await markPaid(db, payment, settlement, now, actor);
  return paid.result;
}

export interface CryptoMonitorResult {
  checked: number;
  paid: number;
  confirming: number;
  waiting: number;
  expired: number;
  latePayment: number;
  manualReview: number;
  errors: number;
  configured: boolean;
}

/**
 * Server-side sweep for the scheduled job route. Works without any customer
 * browser session and also scans recently expired requests for late transfers.
 */
export async function monitorCryptoPayments(
  db: Database,
  options: {
    config?: CryptoPaymentConfig;
    limit?: number;
    now?: Date;
    /** Test seams; production uses the configured RPC clients. */
    explorer?: ExplorerProvider;
    rpc?: BscRpcClient;
  } = {},
): Promise<CryptoMonitorResult> {
  const config = options.config ?? assertCryptoPaymentConfig();
  const now = options.now ?? new Date();
  const limit = options.limit ?? 25;
  const lateCutoff = new Date(
    now.getTime() - config.latePaymentWindowHours * 60 * 60 * 1000,
  );

  // Release reserved amounts that can no longer receive a matching transfer
  // (24 h after payment or expiry). Without this, each price could only be
  // used ~9,999 times in total.
  await db
    .update(cryptoPayments)
    .set({ amountReleasedAt: now })
    .where(
      and(
        isNull(cryptoPayments.amountReleasedAt),
        or(
          and(eq(cryptoPayments.status, "paid"), lte(cryptoPayments.paidAt, lateCutoff)),
          and(eq(cryptoPayments.status, "expired"), lte(cryptoPayments.expiresAt, lateCutoff)),
        ),
      ),
    );

  // Expired rows are only re-scanned inside the late-payment window. Older
  // expired rows must not occupy the batch, or active payments would starve.
  const rows = await db
    .select()
    .from(cryptoPayments)
    .where(
      or(
        inArray(cryptoPayments.status, ACTIVE_STATUSES),
        and(
          eq(cryptoPayments.status, "expired"),
          lte(cryptoPayments.expiresAt, now),
          gte(cryptoPayments.expiresAt, lateCutoff),
        ),
      ),
    )
    .orderBy(cryptoPayments.lastVerifiedAt, cryptoPayments.createdAt)
    .limit(limit);

  const out: CryptoMonitorResult = {
    checked: 0,
    paid: 0,
    confirming: 0,
    waiting: 0,
    expired: 0,
    latePayment: 0,
    manualReview: 0,
    errors: 0,
    configured: true,
  };

  for (const row of rows) {
    if (row.status === "expired" && row.expiresAt.getTime() < lateCutoff.getTime()) continue;
    out.checked += 1;
    try {
      const verified = await verifyCryptoPayment(db, row.id, {
        config,
        now,
        actor: "worker",
        explorer: options.explorer,
        rpc: options.rpc,
      });
      if (verified.status === "paid") out.paid += 1;
      else if (verified.status === "confirming") out.confirming += 1;
      else if (verified.status === "expired") out.expired += 1;
      else if (verified.status === "late_payment") out.latePayment += 1;
      else if (verified.status === "manual_review") out.manualReview += 1;
      else if (verified.status === "verification_error") out.errors += 1;
      else out.waiting += 1;
    } catch {
      out.errors += 1;
    }
  }
  return out;
}

export { formatRawTokenAmount };
