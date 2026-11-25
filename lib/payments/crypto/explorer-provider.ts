/**
 * Transaction discovery adapter for BEP-20 token transfers.
 *
 * Etherscan API V2 is used only to discover candidate transaction hashes.
 * Payment confirmation always comes from an independent BNB Smart Chain RPC
 * verification (see bnb-verifier.ts). The adapter is deliberately isolated so
 * another explorer can replace it without changing payment logic.
 */

export interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  /** Exact token value in base units, as returned by the explorer. */
  valueRaw: string;
  blockNumber: number;
  timestamp: Date;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

export interface TokenTransferQuery {
  /** Do not return transfers older than this instant. */
  since: Date;
  /** Optional upper bound for the transfer timestamp. */
  until?: Date;
  /**
   * Optional block to resume from (a previous scan's cursor minus a reorg
   * margin). Providers that cannot use it ignore it and rely on `since`.
   */
  fromBlock?: number;
}

export interface ExplorerScanResult {
  transfers: TokenTransfer[];
  pagesScanned: number;
  /** True when the safety page cap was reached before reaching `since`. */
  truncated: boolean;
  /** Last block fully scanned, when the provider is block based. */
  scannedToBlock?: number;
}

export interface ExplorerProvider {
  readonly name: string;
  findTokenTransfers(query: TokenTransferQuery): Promise<ExplorerScanResult>;
}

export type ExplorerErrorKind = "rate_limited" | "network" | "invalid_response" | "api_error";

export class ExplorerError extends Error {
  readonly kind: ExplorerErrorKind;

  constructor(kind: ExplorerErrorKind, message: string) {
    super(message);
    this.name = "ExplorerError";
    this.kind = kind;
  }
}

interface EtherscanTokenTxRow {
  hash?: unknown;
  from?: unknown;
  to?: unknown;
  contractAddress?: unknown;
  value?: unknown;
  blockNumber?: unknown;
  timeStamp?: unknown;
  tokenSymbol?: unknown;
  tokenDecimal?: unknown;
}

interface EtherscanResponse {
  status?: unknown;
  message?: unknown;
  result?: unknown;
}

export interface EtherscanProviderOptions {
  apiKey: string;
  wallet: string;
  tokenContract: string;
  chainId: number;
  baseUrl: string;
  fetchImpl?: typeof fetch;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isTransferRow(value: unknown): value is EtherscanTokenTxRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export class EtherscanV2TokenTransferProvider implements ExplorerProvider {
  readonly name = "etherscan-v2";
  private readonly options: Required<
    Pick<EtherscanProviderOptions, "apiKey" | "wallet" | "tokenContract" | "chainId" | "baseUrl">
  > &
    EtherscanProviderOptions;

  constructor(options: EtherscanProviderOptions) {
    this.options = options;
  }

  async findTokenTransfers(query: TokenTransferQuery): Promise<ExplorerScanResult> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const pageSize = this.options.pageSize ?? 100;
    const maxPages = this.options.maxPages ?? 20;
    const timeoutMs = this.options.timeoutMs ?? 12_000;
    const transfers: TokenTransfer[] = [];
    let truncated = false;
    let pagesScanned = 0;

    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(this.options.baseUrl);
      url.searchParams.set("chainid", String(this.options.chainId));
      url.searchParams.set("module", "account");
      url.searchParams.set("action", "tokentx");
      url.searchParams.set("contractaddress", this.options.tokenContract);
      url.searchParams.set("address", this.options.wallet);
      url.searchParams.set("page", String(page));
      url.searchParams.set("offset", String(pageSize));
      url.searchParams.set("sort", "desc");
      url.searchParams.set("startblock", "0");
      url.searchParams.set("endblock", "99999999");
      url.searchParams.set("apikey", this.options.apiKey);

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch {
        throw new ExplorerError("network", "The blockchain explorer could not be reached");
      }

      if (response.status === 429) {
        throw new ExplorerError("rate_limited", "The blockchain explorer rate limit was reached");
      }
      if (!response.ok) {
        throw new ExplorerError(
          "api_error",
          `The blockchain explorer returned HTTP ${response.status}`,
        );
      }

      let payload: EtherscanResponse;
      try {
        payload = (await response.json()) as EtherscanResponse;
      } catch {
        throw new ExplorerError("invalid_response", "The blockchain explorer returned invalid JSON");
      }

      pagesScanned = page;
      const result = payload.result;
      if (Array.isArray(result)) {
        if (result.length === 0) break;
        let reachedSince = false;
        for (const raw of result) {
          if (!isTransferRow(raw)) continue;
          const parsed = this.parseRow(raw);
          if (!parsed) continue;
          if (parsed.timestamp.getTime() < query.since.getTime()) {
            reachedSince = true;
            continue;
          }
          if (query.until && parsed.timestamp.getTime() > query.until.getTime()) continue;
          transfers.push(parsed);
        }
        if (reachedSince || result.length < pageSize) break;
        if (page === maxPages) truncated = true;
        continue;
      }

      // Etherscan returns status "0" with this exact message when the wallet has
      // no matching transfers. Treat it as an empty page, not an outage.
      const message = asString(payload.message) ?? "";
      const resultText = asString(result) ?? "";
      if (/no transactions found/i.test(message) || /no transactions found/i.test(resultText)) {
        break;
      }
      if (/rate limit|too many requests/i.test(message) || /rate limit|too many/i.test(resultText)) {
        throw new ExplorerError("rate_limited", "The blockchain explorer rate limit was reached");
      }
      throw new ExplorerError("api_error", "The blockchain explorer rejected the request");
    }

    const deduped = new Map<string, TokenTransfer>();
    for (const transfer of transfers) {
      if (!deduped.has(transfer.hash)) deduped.set(transfer.hash, transfer);
    }
    return { transfers: [...deduped.values()], pagesScanned, truncated };
  }

  private parseRow(row: EtherscanTokenTxRow): TokenTransfer | null {
    const hash = asString(row.hash);
    const from = asString(row.from);
    const to = asString(row.to);
    const contractAddress = asString(row.contractAddress);
    const valueRaw = asString(row.value);
    const blockNumberRaw = asString(row.blockNumber);
    const timeStampRaw = asString(row.timeStamp);
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
    if (!from || !to || !contractAddress || !valueRaw) return null;
    if (!/^\d+$/.test(valueRaw)) return null;
    if (!blockNumberRaw || !/^\d+$/.test(blockNumberRaw)) return null;
    if (!timeStampRaw || !/^\d+$/.test(timeStampRaw)) return null;
    const blockNumber = Number(blockNumberRaw);
    const seconds = Number(timeStampRaw);
    if (!Number.isSafeInteger(blockNumber) || !Number.isSafeInteger(seconds)) return null;
    const timestamp = new Date(seconds * 1000);
    if (Number.isNaN(timestamp.getTime())) return null;
    const tokenDecimalsRaw = asString(row.tokenDecimal);
    const tokenDecimals = tokenDecimalsRaw ? Number(tokenDecimalsRaw) : undefined;
    return {
      hash,
      from,
      to,
      contractAddress,
      valueRaw,
      blockNumber,
      timestamp,
      tokenSymbol: asString(row.tokenSymbol) ?? undefined,
      tokenDecimals:
        tokenDecimals !== undefined && Number.isSafeInteger(tokenDecimals)
          ? tokenDecimals
          : undefined,
    };
  }
}
