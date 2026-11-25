/**
 * Independent BNB Smart Chain verification for BEP-20 transfers.
 *
 * The explorer may suggest a transaction hash, but a payment is only accepted
 * after this module has checked the transaction, its successful receipt, the
 * token contract's Transfer log, the exact recipient, the exact raw amount,
 * the block timestamp, and the confirmation count against a canonical BNB
 * Smart Chain RPC node.
 */

import { sameAddress } from "@/lib/payments/crypto/amount";

export const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  blockNumber: number | null;
  input: string;
}

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  logIndex?: number;
}

export interface RpcReceipt {
  transactionHash: string;
  status: "0x0" | "0x1" | string;
  blockNumber: number;
  blockHash?: string;
  logs: RpcLog[];
}

export interface BscRpcClient {
  getChainId(): Promise<number>;
  getLatestBlockNumber(): Promise<number>;
  getTransaction(hash: string): Promise<RpcTransaction | null>;
  getTransactionReceipt(hash: string): Promise<RpcReceipt | null>;
  getBlockTimestamp(blockNumber: number): Promise<Date | null>;
}

export type RpcErrorKind = "network" | "rpc_error" | "invalid_response" | "wrong_network";

export class RpcError extends Error {
  readonly kind: RpcErrorKind;

  constructor(kind: RpcErrorKind, message: string) {
    super(message);
    this.name = "RpcError";
    this.kind = kind;
  }
}

export interface HttpBnbRpcClientOptions {
  url: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface JsonRpcResponse {
  jsonrpc?: unknown;
  id?: unknown;
  result?: unknown;
  error?: { code?: unknown; message?: unknown };
}

function hexToSafeNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  const parsed = BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(parsed);
}

function parseTransaction(value: unknown): RpcTransaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const hash = typeof row.hash === "string" ? row.hash : null;
  const from = typeof row.from === "string" ? row.from : null;
  const to = typeof row.to === "string" ? row.to : null;
  if (!hash || !from) return null;
  return {
    hash,
    from,
    to,
    blockNumber: hexToSafeNumber(row.blockNumber),
    input: typeof row.input === "string" ? row.input : "0x",
  };
}

function parseLog(value: unknown): RpcLog | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.address !== "string") return null;
  if (!Array.isArray(row.topics) || !row.topics.every((topic) => typeof topic === "string")) {
    return null;
  }
  if (typeof row.data !== "string") return null;
  const logIndex = hexToSafeNumber(row.logIndex);
  return {
    address: row.address,
    topics: row.topics as string[],
    data: row.data,
    logIndex: logIndex ?? undefined,
  };
}

function parseReceipt(value: unknown): RpcReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.transactionHash !== "string") return null;
  if (typeof row.status !== "string") return null;
  const blockNumber = hexToSafeNumber(row.blockNumber);
  if (blockNumber === null) return null;
  if (!Array.isArray(row.logs)) return null;
  const logs = row.logs.map(parseLog).filter((log): log is RpcLog => log !== null);
  return {
    transactionHash: row.transactionHash,
    status: row.status,
    blockNumber,
    blockHash: typeof row.blockHash === "string" ? row.blockHash : undefined,
    logs,
  };
}

export class HttpBnbRpcClient implements BscRpcClient {
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private chainIdCache: number | null = null;

  constructor(options: HttpBnbRpcClientOptions) {
    this.url = options.url;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 12_000;
  }

  private async call(method: string, params: unknown[]): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    } catch {
      throw new RpcError("network", "The BNB Smart Chain RPC could not be reached");
    }
    if (!response.ok) {
      throw new RpcError("rpc_error", `The BNB Smart Chain RPC returned HTTP ${response.status}`);
    }
    let payload: JsonRpcResponse;
    try {
      payload = (await response.json()) as JsonRpcResponse;
    } catch {
      throw new RpcError("invalid_response", "The BNB Smart Chain RPC returned invalid JSON");
    }
    if (payload.error) {
      const message =
        typeof payload.error.message === "string" ? payload.error.message : "Unknown RPC error";
      throw new RpcError("rpc_error", `BNB Smart Chain RPC error: ${message}`);
    }
    if (!("result" in payload)) {
      throw new RpcError("invalid_response", "The BNB Smart Chain RPC response has no result");
    }
    return payload.result;
  }

  async getChainId(): Promise<number> {
    if (this.chainIdCache !== null) return this.chainIdCache;
    const raw = await this.call("eth_chainId", []);
    const chainId = hexToSafeNumber(raw);
    if (chainId === null) {
      throw new RpcError("invalid_response", "The BNB Smart Chain RPC returned an invalid chain id");
    }
    this.chainIdCache = chainId;
    return chainId;
  }

  async getLatestBlockNumber(): Promise<number> {
    const raw = await this.call("eth_blockNumber", []);
    const blockNumber = hexToSafeNumber(raw);
    if (blockNumber === null) {
      throw new RpcError("invalid_response", "The RPC returned an invalid latest block number");
    }
    return blockNumber;
  }

  async getTransaction(hash: string): Promise<RpcTransaction | null> {
    return parseTransaction(await this.call("eth_getTransactionByHash", [hash]));
  }

  async getTransactionReceipt(hash: string): Promise<RpcReceipt | null> {
    return parseReceipt(await this.call("eth_getTransactionReceipt", [hash]));
  }

  async getBlockTimestamp(blockNumber: number): Promise<Date | null> {
    const value = await this.call("eth_getBlockByNumber", [
      `0x${blockNumber.toString(16)}`,
      false,
    ]);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const seconds = hexToSafeNumber((value as Record<string, unknown>).timestamp);
    if (seconds === null) return null;
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}

export interface TransferExpectation {
  tokenContract: string;
  wallet: string;
  amountRaw: bigint;
  requiredConfirmations: number;
  expectedChainId: number;
}

export interface VerifiedSettlement {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  valueRaw: string;
  blockNumber: number;
  confirmations: number;
  blockTime: Date;
}

export type TransferVerification =
  | { outcome: "verified"; settlement: VerifiedSettlement }
  | {
      outcome: "confirming";
      txHash: string;
      blockNumber: number;
      confirmations: number;
      blockTime: Date;
      fromAddress: string;
    }
  | {
      outcome: "rejected";
      reason:
        | "wrong_network"
        | "transaction_not_found"
        | "receipt_pending"
        | "failed_receipt"
        | "no_matching_transfer"
        | "ambiguous_transfer";
    };

function toTopicAddress(topic: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  return `0x${topic.slice(26)}`.toLowerCase();
}

function decodeMatchingTransferLogs(
  receipt: RpcReceipt,
  expectation: TransferExpectation,
): Array<{ to: string; value: bigint; logIndex?: number }> {
  const matches: Array<{ to: string; value: bigint; logIndex?: number }> = [];
  for (const log of receipt.logs) {
    if (!sameAddress(log.address, expectation.tokenContract)) continue;
    if (log.topics.length !== 3) continue;
    if (log.topics[0]!.toLowerCase() !== TRANSFER_EVENT_TOPIC) continue;
    const to = toTopicAddress(log.topics[2]!);
    if (!to || !sameAddress(to, expectation.wallet)) continue;
    if (!/^0x[0-9a-fA-F]{64}$/.test(log.data)) continue;
    const value = BigInt(log.data);
    if (value !== expectation.amountRaw) continue;
    matches.push({ to, value, logIndex: log.logIndex });
  }
  return matches;
}

/**
 * Verify a candidate transaction against independent RPC data.
 *
 * A `confirming` result is not a payment. Callers must not mark an order paid
 * or start fulfillment until the outcome is `verified`.
 */
export async function verifyBnbTransfer(
  client: BscRpcClient,
  txHash: string,
  expectation: TransferExpectation,
): Promise<TransferVerification> {
  const chainId = await client.getChainId();
  if (chainId !== expectation.expectedChainId) {
    return { outcome: "rejected", reason: "wrong_network" };
  }

  const transaction = await client.getTransaction(txHash);
  if (!transaction) return { outcome: "rejected", reason: "transaction_not_found" };
  if (!sameAddress(transaction.hash, txHash)) {
    return { outcome: "rejected", reason: "transaction_not_found" };
  }

  const receipt = await client.getTransactionReceipt(txHash);
  if (!receipt) {
    return { outcome: "rejected", reason: "receipt_pending" };
  }
  if (receipt.status !== "0x1") {
    return { outcome: "rejected", reason: "failed_receipt" };
  }

  const matches = decodeMatchingTransferLogs(receipt, expectation);
  if (matches.length === 0) {
    return { outcome: "rejected", reason: "no_matching_transfer" };
  }
  if (matches.length > 1) {
    return { outcome: "rejected", reason: "ambiguous_transfer" };
  }

  const blockTime = await client.getBlockTimestamp(receipt.blockNumber);
  if (!blockTime) {
    return { outcome: "rejected", reason: "receipt_pending" };
  }

  const latestBlock = await client.getLatestBlockNumber();
  const confirmations = Math.max(0, latestBlock - receipt.blockNumber + 1);
  const match = matches[0]!;
  if (confirmations < expectation.requiredConfirmations) {
    return {
      outcome: "confirming",
      txHash: transaction.hash,
      blockNumber: receipt.blockNumber,
      confirmations,
      blockTime,
      fromAddress: transaction.from,
    };
  }

  return {
    outcome: "verified",
    settlement: {
      txHash: transaction.hash,
      fromAddress: transaction.from,
      toAddress: match.to,
      valueRaw: match.value.toString(),
      blockNumber: receipt.blockNumber,
      confirmations,
      blockTime,
    },
  };
}
