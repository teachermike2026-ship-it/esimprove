/**
 * Transaction discovery through a BNB Smart Chain JSON-RPC endpoint
 * (NodeReal MegaNode by default: https://dashboard.nodereal.io/api-key).
 *
 * Discovery reads ERC-20/BEP-20 `Transfer` logs emitted by the configured
 * token contract whose indexed recipient is the receiving wallet. It uses only
 * standard JSON-RPC methods (eth_blockNumber, eth_getBlockByNumber,
 * eth_getLogs), so no explorer API key is needed and the provider can be
 * swapped for any other BSC RPC.
 *
 * Discovery is not proof of payment. Every candidate is re-verified by
 * bnb-verifier.ts (receipt status, contract, recipient, exact amount,
 * confirmations) before an order can be marked paid.
 */

import {
  ExplorerError,
  type ExplorerProvider,
  type ExplorerScanResult,
  type TokenTransfer,
  type TokenTransferQuery,
} from "@/lib/payments/crypto/explorer-provider";
import { TRANSFER_EVENT_TOPIC } from "@/lib/payments/crypto/bnb-verifier";

export interface RpcLogProviderOptions {
  rpcUrl: string;
  wallet: string;
  tokenContract: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** First eth_getLogs block window. Shrinks automatically if the RPC refuses it. */
  initialChunkBlocks?: number;
  /** Smallest window before giving up on a range-limit error. */
  minChunkBlocks?: number;
  /** Hard cap on eth_getLogs calls per scan, so one pass cannot exhaust quota. */
  maxLogRequests?: number;
  /**
   * Conservative lower bound for BSC block time, used only to estimate where
   * to start scanning. The estimate is always corrected against real block
   * timestamps, so a wrong guess costs requests, never correctness.
   */
  estimatedBlockSeconds?: number;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: { code?: unknown; message?: unknown };
}

interface RawLog {
  transactionHash?: unknown;
  blockNumber?: unknown;
  address?: unknown;
  topics?: unknown;
  data?: unknown;
  removed?: unknown;
}

const RANGE_ERROR_PATTERN =
  /range|too many|limit|exceed|query returned more than|block range|response size/i;

function hexToNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  const parsed = BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(parsed);
}

function toHex(value: number): string {
  return `0x${value.toString(16)}`;
}

function addressTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

function topicToAddress(topic: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  return `0x${topic.slice(26)}`.toLowerCase();
}

class RangeTooLargeError extends Error {}

export class RpcLogTransferProvider implements ExplorerProvider {
  readonly name = "bsc-rpc-logs";
  private readonly options: RpcLogProviderOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly blockTimeCache = new Map<number, Date>();

  constructor(options: RpcLogProviderOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async call(method: string, params: unknown[]): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.options.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 12_000),
        cache: "no-store",
      });
    } catch {
      throw new ExplorerError("network", "The BNB Smart Chain RPC could not be reached");
    }
    if (response.status === 429) {
      throw new ExplorerError("rate_limited", "The BNB Smart Chain RPC rate limit was reached");
    }
    let payload: JsonRpcResponse;
    try {
      payload = (await response.json()) as JsonRpcResponse;
    } catch {
      if (!response.ok) {
        throw new ExplorerError("api_error", `The BNB Smart Chain RPC returned HTTP ${response.status}`);
      }
      throw new ExplorerError("invalid_response", "The BNB Smart Chain RPC returned invalid JSON");
    }
    if (payload.error) {
      const message = typeof payload.error.message === "string" ? payload.error.message : "";
      if (method === "eth_getLogs" && RANGE_ERROR_PATTERN.test(message)) {
        throw new RangeTooLargeError(message);
      }
      if (/rate|too many requests|quota|exceeded/i.test(message)) {
        throw new ExplorerError("rate_limited", "The BNB Smart Chain RPC rate limit was reached");
      }
      // Never echo the provider message: it can contain the endpoint/API key.
      throw new ExplorerError("api_error", `The BNB Smart Chain RPC rejected ${method}`);
    }
    if (!response.ok) {
      throw new ExplorerError("api_error", `The BNB Smart Chain RPC returned HTTP ${response.status}`);
    }
    if (!("result" in payload)) {
      throw new ExplorerError("invalid_response", "The BNB Smart Chain RPC response has no result");
    }
    return payload.result;
  }

  private async latestBlock(): Promise<number> {
    const block = hexToNumber(await this.call("eth_blockNumber", []));
    if (block === null) {
      throw new ExplorerError("invalid_response", "The RPC returned an invalid latest block");
    }
    return block;
  }

  private async blockTime(blockNumber: number): Promise<Date> {
    const cached = this.blockTimeCache.get(blockNumber);
    if (cached) return cached;
    const value = await this.call("eth_getBlockByNumber", [toHex(blockNumber), false]);
    const seconds =
      value && typeof value === "object" && !Array.isArray(value)
        ? hexToNumber((value as Record<string, unknown>).timestamp)
        : null;
    if (seconds === null) {
      throw new ExplorerError("invalid_response", "The RPC returned an invalid block");
    }
    const date = new Date(seconds * 1000);
    this.blockTimeCache.set(blockNumber, date);
    return date;
  }

  /**
   * Find a block at or before `since`. Starts from an estimate and steps back
   * (doubling) until the block timestamp is not after `since`.
   */
  private async startBlockFor(since: Date, latest: number): Promise<number> {
    const latestTime = await this.blockTime(latest);
    const secondsBack = Math.max(0, (latestTime.getTime() - since.getTime()) / 1000);
    // BSC mainnet measured at ~0.45 s per block (read-only check). The
    // estimate is corrected against real timestamps either way.
    const blockSeconds = this.options.estimatedBlockSeconds ?? 0.45;
    let step = Math.max(1, Math.ceil(secondsBack / blockSeconds));
    let candidate = Math.max(0, latest - step);
    for (let attempt = 0; attempt < 12 && candidate > 0; attempt += 1) {
      const time = await this.blockTime(candidate);
      if (time.getTime() <= since.getTime()) return candidate;
      step *= 2;
      candidate = Math.max(0, latest - step);
    }
    return candidate;
  }

  private async getLogs(fromBlock: number, toBlock: number): Promise<RawLog[]> {
    const result = await this.call("eth_getLogs", [
      {
        fromBlock: toHex(fromBlock),
        toBlock: toHex(toBlock),
        address: this.options.tokenContract,
        topics: [TRANSFER_EVENT_TOPIC, null, addressTopic(this.options.wallet)],
      },
    ]);
    if (!Array.isArray(result)) {
      throw new ExplorerError("invalid_response", "The RPC returned invalid logs");
    }
    return result as RawLog[];
  }

  async findTokenTransfers(query: TokenTransferQuery): Promise<ExplorerScanResult> {
    const latest = await this.latestBlock();
    const startBlock =
      query.fromBlock !== undefined && Number.isSafeInteger(query.fromBlock) && query.fromBlock >= 0
        ? Math.min(query.fromBlock, latest)
        : await this.startBlockFor(query.since, latest);
    const minChunk = this.options.minChunkBlocks ?? 10;
    const maxRequests = this.options.maxLogRequests ?? 200;
    // NodeReal BSC mainnet accepted 50,000-block wallet-filtered ranges in a
    // read-only check; smaller windows are used automatically if refused.
    let chunk = this.options.initialChunkBlocks ?? 50_000;
    let from = startBlock;
    let requests = 0;
    let truncated = false;
    const transfers = new Map<string, TokenTransfer>();

    while (from <= latest) {
      if (requests >= maxRequests) {
        truncated = true;
        break;
      }
      const to = Math.min(latest, from + chunk - 1);
      let logs: RawLog[];
      try {
        requests += 1;
        logs = await this.getLogs(from, to);
      } catch (error) {
        if (error instanceof RangeTooLargeError) {
          if (chunk <= minChunk) {
            throw new ExplorerError("api_error", "The RPC refused even the smallest log range");
          }
          chunk = Math.max(minChunk, Math.floor(chunk / 2));
          continue;
        }
        throw error;
      }

      for (const log of logs) {
        const parsed = await this.parseLog(log);
        if (!parsed) continue;
        if (parsed.timestamp.getTime() < query.since.getTime()) continue;
        if (query.until && parsed.timestamp.getTime() > query.until.getTime()) continue;
        // One transaction can emit several transfers; the verifier re-checks
        // all of them, so one candidate per hash is enough.
        if (!transfers.has(parsed.hash)) transfers.set(parsed.hash, parsed);
      }
      from = to + 1;
    }

    return {
      transfers: [...transfers.values()],
      pagesScanned: requests,
      truncated,
      scannedToBlock: from - 1,
    };
  }

  private async parseLog(log: RawLog): Promise<TokenTransfer | null> {
    if (log.removed === true) return null;
    const hash = typeof log.transactionHash === "string" ? log.transactionHash : null;
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
    if (typeof log.address !== "string") return null;
    if (log.address.toLowerCase() !== this.options.tokenContract.toLowerCase()) return null;
    if (!Array.isArray(log.topics) || log.topics.length !== 3) return null;
    const [topic0, fromTopic, toTopic] = log.topics as unknown[];
    if (typeof topic0 !== "string" || topic0.toLowerCase() !== TRANSFER_EVENT_TOPIC) return null;
    const from = typeof fromTopic === "string" ? topicToAddress(fromTopic) : null;
    const to = typeof toTopic === "string" ? topicToAddress(toTopic) : null;
    if (!from || !to || to !== this.options.wallet.toLowerCase()) return null;
    if (typeof log.data !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(log.data)) return null;
    const blockNumber = hexToNumber(log.blockNumber);
    if (blockNumber === null) return null;
    const timestamp = await this.blockTime(blockNumber);
    return {
      hash,
      from,
      to,
      contractAddress: log.address,
      valueRaw: BigInt(log.data).toString(),
      blockNumber,
      timestamp,
    };
  }
}
