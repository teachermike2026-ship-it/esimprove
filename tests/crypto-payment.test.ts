import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { DatabaseHandle } from "@/lib/db/client";
import { cryptoPayments, esims, orderItems, orders } from "@/lib/db/schema";
import { addCartItem, getOrCreateCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout";
import {
  CRYPTO_PAYMENT_CONSTANTS,
  publicCryptoPaymentConfig,
  validateCryptoPaymentConfig,
  type CryptoPaymentConfig,
} from "@/lib/payments/crypto/config";
import {
  AMOUNT_SUFFIX_STEP,
  baseAmountRaw,
  formatRawTokenAmount,
  generateCryptoPaymentReference,
  generatePaymentAmount,
  parseRawAmountFromDb,
  parseTokenAmount,
  sameAddress,
} from "@/lib/payments/crypto/amount";
import {
  EtherscanV2TokenTransferProvider,
  ExplorerError,
  type ExplorerProvider,
  type TokenTransfer,
} from "@/lib/payments/crypto/explorer-provider";
import {
  TRANSFER_EVENT_TOPIC,
  verifyBnbTransfer,
  type BscRpcClient,
  type RpcReceipt,
  type RpcTransaction,
} from "@/lib/payments/crypto/bnb-verifier";
import { RpcLogTransferProvider } from "@/lib/payments/crypto/rpc-log-provider";
import {
  createCryptoPayment,
  getCryptoPaymentByOrderId,
  verifyCryptoPayment,
} from "@/lib/payments/crypto/payment-service";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { en, type TranslationKey } from "@/lib/i18n/dictionaries/en";
import { makeTestDb } from "./helpers/db";

const WALLET = "0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E";
const CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const TX_HASH = `0x${"a".repeat(64)}`;
const TX_HASH_2 = `0x${"b".repeat(64)}`;
// Lifecycle scenarios share one database. Each order needs a distinct hash so
// the duplicate-hash guard is exercised intentionally, not by test leakage.
const LATE_TX_HASH = `0x${"c".repeat(64)}`;
const DUPLICATE_TX_HASH = `0x${"d".repeat(64)}`;
const FALLBACK_TX_HASH = `0x${"e".repeat(64)}`;
const AMBIGUOUS_TX_HASH = `0x${"f".repeat(64)}`;
const AMBIGUOUS_TX_HASH_2 = `0x${"9".repeat(64)}`;

const TEST_CONFIG: CryptoPaymentConfig = {
  wallet: WALLET,
  tokenContract: CONTRACT,
  chainId: 56,
  rpcUrl: "https://rpc.example.invalid",
  confirmationsRequired: CRYPTO_PAYMENT_CONSTANTS.confirmationsRequired,
  paymentWindowMinutes: CRYPTO_PAYMENT_CONSTANTS.paymentWindowMinutes,
  verificationIntervalSeconds: CRYPTO_PAYMENT_CONSTANTS.verificationIntervalSeconds,
  tokenDecimals: CRYPTO_PAYMENT_CONSTANTS.tokenDecimals,
  network: CRYPTO_PAYMENT_CONSTANTS.network,
  standard: CRYPTO_PAYMENT_CONSTANTS.standard,
  asset: CRYPTO_PAYMENT_CONSTANTS.asset,
  assetSymbol: CRYPTO_PAYMENT_CONSTANTS.assetSymbol,
  bscScanTxBaseUrl: CRYPTO_PAYMENT_CONSTANTS.bscScanTxBaseUrl,
  latePaymentWindowHours: CRYPTO_PAYMENT_CONSTANTS.latePaymentWindowHours,
};

class FakeRpc implements BscRpcClient {
  chainId = 56;
  latestBlock = 500;
  transactions = new Map<string, RpcTransaction>();
  receipts = new Map<string, RpcReceipt>();
  blockTimes = new Map<number, Date>();

  async getChainId(): Promise<number> {
    return this.chainId;
  }

  async getLatestBlockNumber(): Promise<number> {
    return this.latestBlock;
  }

  async getTransaction(hash: string): Promise<RpcTransaction | null> {
    return this.transactions.get(hash.toLowerCase()) ?? null;
  }

  async getTransactionReceipt(hash: string): Promise<RpcReceipt | null> {
    return this.receipts.get(hash.toLowerCase()) ?? null;
  }

  async getBlockTimestamp(blockNumber: number): Promise<Date | null> {
    return this.blockTimes.get(blockNumber) ?? null;
  }
}

class FakeExplorer implements ExplorerProvider {
  readonly name = "fake-explorer";
  transfers: TokenTransfer[] = [];
  truncated = false;

  async findTokenTransfers(query: {
    since: Date;
    until?: Date;
  }): Promise<{ transfers: TokenTransfer[]; pagesScanned: number; truncated: boolean }> {
    return {
      transfers: this.transfers.filter(
        (transfer) =>
          transfer.timestamp.getTime() >= query.since.getTime() &&
          (!query.until || transfer.timestamp.getTime() <= query.until.getTime()),
      ),
      pagesScanned: 1,
      truncated: this.truncated,
    };
  }
}

function topicAddress(address: string): string {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

function topicAmount(value: bigint): string {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function registerTransfer(
  rpc: FakeRpc,
  input: {
    hash: string;
    from?: string;
    to?: string;
    contract?: string;
    amountRaw: bigint;
    blockNumber: number;
    blockTime: Date;
    status?: string;
    duplicateLog?: boolean;
  },
): TokenTransfer {
  const hash = input.hash.toLowerCase();
  const from = input.from ?? "0x1111111111111111111111111111111111111111";
  const to = input.to ?? WALLET;
  const contract = input.contract ?? CONTRACT;
  rpc.transactions.set(hash, {
    hash,
    from,
    to: contract,
    blockNumber: input.blockNumber,
    input: "0x",
  });
  const logs = [
    {
      address: contract,
      topics: [TRANSFER_EVENT_TOPIC, topicAddress(from), topicAddress(to)],
      data: topicAmount(input.amountRaw),
    },
  ];
  if (input.duplicateLog) {
    logs.push({
      address: contract,
      topics: [TRANSFER_EVENT_TOPIC, topicAddress(from), topicAddress(to)],
      data: topicAmount(input.amountRaw),
    });
  }
  rpc.receipts.set(hash, {
    transactionHash: hash,
    status: input.status ?? "0x1",
    blockNumber: input.blockNumber,
    logs,
  });
  rpc.blockTimes.set(input.blockNumber, input.blockTime);
  return {
    hash,
    from,
    to,
    contractAddress: contract,
    valueRaw: input.amountRaw.toString(),
    blockNumber: input.blockNumber,
    timestamp: input.blockTime,
  };
}

function transferFor(input: {
  hash: string;
  amountRaw: bigint;
  blockNumber: number;
  blockTime: Date;
  to?: string;
  contract?: string;
}): TokenTransfer {
  return {
    hash: input.hash.toLowerCase(),
    from: "0x1111111111111111111111111111111111111111",
    to: input.to ?? WALLET,
    contractAddress: input.contract ?? CONTRACT,
    valueRaw: input.amountRaw.toString(),
    blockNumber: input.blockNumber,
    timestamp: input.blockTime,
  };
}

async function makeCryptoOrder(
  handle: DatabaseHandle,
  idempotencyKey: string,
): Promise<{
  orderId: string;
  orderNumber: string;
  cryptoId: string;
  amountRaw: bigint;
  amountUsdt: string;
  createdAt: Date;
  expiresAt: Date;
}> {
  const db = handle.db;
  const cart = await getOrCreateCart(db);
  const plan = await db.query.plans.findFirst();
  expect(plan).toBeTruthy();
  await addCartItem(db, cart.cartId, plan!.id, 1);
  const result = await createCheckout(db, {
    cartToken: cart.token,
    email: `${idempotencyKey}@example.com`,
    name: "Crypto Traveler",
    country: "US",
    idempotencyKey,
    paymentMethod: "crypto",
  });
  const crypto = await getCryptoPaymentByOrderId(db, result.orderId);
  expect(crypto).toBeTruthy();
  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, result.orderId))
    .limit(1);
  const order = orderRows[0]!;
  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    cryptoId: crypto!.id,
    amountRaw: parseRawAmountFromDb(crypto!.amountRaw),
    amountUsdt: crypto!.amountUsdt,
    createdAt: order.createdAt,
    expiresAt: crypto!.expiresAt,
  };
}

async function orderEsimCount(handle: DatabaseHandle, orderId: string): Promise<number> {
  const rows = await handle.db
    .select({ id: esims.id })
    .from(esims)
    .innerJoin(orderItems, eq(esims.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, orderId));
  return rows.length;
}

describe("crypto amount precision", () => {
  it("converts USD cents to exact 18-decimal raw units without floating point", () => {
    expect(baseAmountRaw(2858, "USD")).toBe(28_580_000_000_000_000_000n);
    expect(formatRawTokenAmount(baseAmountRaw(2858, "USD"))).toBe("28.58");
    expect(parseTokenAmount("28.58")).toBe(28_580_000_000_000_000_000n);
    expect(parseRawAmountFromDb("28580000000000000000")).toBe(
      28_580_000_000_000_000_000n,
    );
    expect(() => baseAmountRaw(100, "EUR")).toThrow(/USD/);
    expect(() => baseAmountRaw(0, "USD")).toThrow();
    expect(() => parseTokenAmount("1.0000000000000000001")).toThrow(/decimal/);
  });

  it("adds a cryptographic 4-decimal suffix and round-trips exactly", () => {
    const generated = generatePaymentAmount(2858, "USD", () => 1);
    expect(generated.amountRaw).toBe(
      28_580_000_000_000_000_000n + AMOUNT_SUFFIX_STEP,
    );
    expect(generated.amountUsdt).toBe("28.5801");
    expect(parseTokenAmount(generated.amountUsdt)).toBe(generated.amountRaw);
    expect(generated.suffix).toBe(1);

    const maximum = generatePaymentAmount(2858, "USD", () => 9999);
    expect(maximum.amountUsdt).toBe("29.5799");
    expect(parseTokenAmount(maximum.amountUsdt)).toBe(maximum.amountRaw);
    expect(() => generatePaymentAmount(2858, "USD", () => 0)).toThrow();
    expect(() => generatePaymentAmount(2858, "USD", () => 10000)).toThrow();
  });

  it("formats references and compares addresses case-insensitively", () => {
    expect(generateCryptoPaymentReference()).toMatch(/^ESIM-[0-9A-F]{8}$/);
    expect(sameAddress(WALLET, WALLET.toLowerCase())).toBe(true);
    expect(sameAddress(WALLET, CONTRACT)).toBe(false);
  });
});

describe("crypto configuration", () => {
  const validEnv = {
    PAYMENT_WALLET: WALLET,
    PAYMENT_TOKEN_CONTRACT: CONTRACT,
    PAYMENT_CHAIN_ID: "56",
    BNB_RPC_URL: "https://bsc-rpc.example.invalid",
  } as unknown as NodeJS.ProcessEnv;

  it("fails closed when any required value is missing", () => {
    const empty = validateCryptoPaymentConfig({} as NodeJS.ProcessEnv);
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.problems.join(" ")).toMatch(/PAYMENT_WALLET/);
      expect(empty.problems.join(" ")).not.toMatch(/EXPLORER_API_KEY/);
      expect(empty.problems.join(" ")).toMatch(/BNB_RPC_URL/);
    }

    const partial = validateCryptoPaymentConfig({
      PAYMENT_WALLET: WALLET,
    } as unknown as NodeJS.ProcessEnv);
    expect(partial.ok).toBe(false);
  });

  it("rejects the wrong chain, token, wallet, and RPC URL", () => {
    const wrongChain = validateCryptoPaymentConfig({
      ...validEnv,
      PAYMENT_CHAIN_ID: "1",
    });
    expect(wrongChain.ok).toBe(false);

    const wrongToken = validateCryptoPaymentConfig({
      ...validEnv,
      PAYMENT_TOKEN_CONTRACT: "0x1111111111111111111111111111111111111111",
    });
    expect(wrongToken.ok).toBe(false);

    const wrongWallet = validateCryptoPaymentConfig({
      ...validEnv,
      PAYMENT_WALLET: "not-an-address",
    });
    expect(wrongWallet.ok).toBe(false);

    const differentWallet = validateCryptoPaymentConfig({
      ...validEnv,
      PAYMENT_WALLET: "0x1111111111111111111111111111111111111111",
    });
    expect(differentWallet.ok).toBe(false);
    if (!differentWallet.ok) {
      expect(differentWallet.problems.join(" ")).toMatch(/documented receiving wallet/);
    }

    const checksumChange = validateCryptoPaymentConfig({
      ...validEnv,
      PAYMENT_WALLET: WALLET.toLowerCase(),
    });
    expect(checksumChange.ok).toBe(true);

    const wrongRpc = validateCryptoPaymentConfig({
      ...validEnv,
      BNB_RPC_URL: "ftp://rpc.example.invalid",
    });
    expect(wrongRpc.ok).toBe(false);
  });

  it("accepts the documented configuration and omits secrets from the public projection", () => {
    const result = validateCryptoPaymentConfig(validEnv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const publicConfig = publicCryptoPaymentConfig(result.config);
    expect(publicConfig.wallet).toBe(WALLET);
    expect(publicConfig.tokenContract).toBe(CONTRACT);
    expect(publicConfig.chainId).toBe(56);
    expect(publicConfig.confirmationsRequired).toBe(15);
    expect(publicConfig.paymentWindowMinutes).toBe(30);
    expect(publicConfig.verificationIntervalSeconds).toBe(15);
    expect("rpcUrl" in publicConfig).toBe(false);
  });
});

describe("independent BNB verification", () => {
  it("rejects the wrong network before reading a transaction", async () => {
    const rpc = new FakeRpc();
    rpc.chainId = 1;
    const result = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 1n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(result.outcome).toBe("rejected");
    if (result.outcome === "rejected") expect(result.reason).toBe("wrong_network");
  });

  it("requires a successful receipt and exactly one matching Transfer log", async () => {
    const rpc = new FakeRpc();
    const missing = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 1n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(missing.outcome).toBe("rejected");
    if (missing.outcome === "rejected") expect(missing.reason).toBe("transaction_not_found");

    const blockTime = new Date("2026-01-01T00:00:00Z");
    registerTransfer(rpc, {
      hash: TX_HASH,
      amountRaw: 100n,
      blockNumber: 10,
      blockTime,
      status: "0x0",
    });
    rpc.latestBlock = 100;
    const failed = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 100n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(failed.outcome).toBe("rejected");
    if (failed.outcome === "rejected") expect(failed.reason).toBe("failed_receipt");

    registerTransfer(rpc, {
      hash: TX_HASH,
      amountRaw: 100n,
      blockNumber: 10,
      blockTime,
      to: "0x2222222222222222222222222222222222222222",
    });
    const wrongRecipient = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 100n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(wrongRecipient.outcome).toBe("rejected");
    if (wrongRecipient.outcome === "rejected") {
      expect(wrongRecipient.reason).toBe("no_matching_transfer");
    }

    registerTransfer(rpc, {
      hash: TX_HASH,
      amountRaw: 101n,
      blockNumber: 10,
      blockTime,
    });
    const wrongAmount = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 100n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(wrongAmount.outcome).toBe("rejected");
    if (wrongAmount.outcome === "rejected") {
      expect(wrongAmount.reason).toBe("no_matching_transfer");
    }

    registerTransfer(rpc, {
      hash: TX_HASH,
      amountRaw: 100n,
      blockNumber: 10,
      blockTime,
      duplicateLog: true,
    });
    const ambiguous = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 100n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(ambiguous.outcome).toBe("rejected");
    if (ambiguous.outcome === "rejected") expect(ambiguous.reason).toBe("ambiguous_transfer");
  });

  it("returns confirming below the threshold and verified at the threshold", async () => {
    const rpc = new FakeRpc();
    const blockTime = new Date("2026-01-01T00:00:00Z");
    registerTransfer(rpc, {
      hash: TX_HASH,
      amountRaw: 100n,
      blockNumber: 100,
      blockTime,
    });

    rpc.latestBlock = 113;
    const confirming = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 100n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(confirming.outcome).toBe("confirming");
    if (confirming.outcome === "confirming") expect(confirming.confirmations).toBe(14);

    rpc.latestBlock = 114;
    const verified = await verifyBnbTransfer(rpc, TX_HASH, {
      tokenContract: CONTRACT,
      wallet: WALLET,
      amountRaw: 100n,
      requiredConfirmations: 15,
      expectedChainId: 56,
    });
    expect(verified.outcome).toBe("verified");
    if (verified.outcome === "verified") {
      expect(verified.settlement.confirmations).toBe(15);
      expect(verified.settlement.valueRaw).toBe("100");
      expect(verified.settlement.toAddress).toBe(WALLET.toLowerCase());
    }
  });
});

describe("Etherscan V2 discovery", () => {
  function row(input: {
    hash: string;
    value: string;
    timestamp: number;
    to?: string;
    contract?: string;
  }) {
    return {
      hash: input.hash,
      from: "0x1111111111111111111111111111111111111111",
      to: input.to ?? WALLET,
      contractAddress: input.contract ?? CONTRACT,
      value: input.value,
      blockNumber: "100",
      timeStamp: String(input.timestamp),
      tokenSymbol: "USDT",
      tokenDecimal: "18",
    };
  }

  it("discovers matching token transfers and ignores rows before the window", async () => {
    const now = Math.floor(Date.now() / 1000);
    const calls: string[] = [];
    const provider = new EtherscanV2TokenTransferProvider({
      apiKey: "key",
      wallet: WALLET,
      tokenContract: CONTRACT,
      chainId: 56,
      baseUrl: "https://explorer.example.invalid/api",
      pageSize: 100,
      fetchImpl: (async (url: URL | RequestInfo) => {
        calls.push(String(url));
        return new Response(
          JSON.stringify({
            status: "1",
            message: "OK",
            result: [
              row({ hash: TX_HASH, value: "100", timestamp: now }),
              row({ hash: TX_HASH_2, value: "200", timestamp: now - 3600 }),
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const result = await provider.findTokenTransfers({
      since: new Date((now - 60) * 1000),
    });
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]?.hash).toBe(TX_HASH);
    expect(result.transfers[0]?.valueRaw).toBe("100");
    expect(calls[0]).toContain("chainid=56");
    expect(calls[0]).toContain("contractaddress=" + CONTRACT);
    expect(calls[0]).toContain("action=tokentx");
  });

  it("treats the explorer's empty result as no transfers", async () => {
    const provider = new EtherscanV2TokenTransferProvider({
      apiKey: "key",
      wallet: WALLET,
      tokenContract: CONTRACT,
      chainId: 56,
      baseUrl: "https://explorer.example.invalid/api",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            status: "0",
            message: "No transactions found",
            result: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as typeof fetch,
    });
    const result = await provider.findTokenTransfers({ since: new Date(0) });
    expect(result.transfers).toHaveLength(0);
  });

  it("classifies rate limits without treating them as an empty wallet", async () => {
    const provider = new EtherscanV2TokenTransferProvider({
      apiKey: "key",
      wallet: WALLET,
      tokenContract: CONTRACT,
      chainId: 56,
      baseUrl: "https://explorer.example.invalid/api",
      fetchImpl: (async () => new Response("", { status: 429 })) as typeof fetch,
    });
    await expect(provider.findTokenTransfers({ since: new Date(0) })).rejects.toMatchObject({
      kind: "rate_limited",
    });
    await expect(provider.findTokenTransfers({ since: new Date(0) })).rejects.toBeInstanceOf(
      ExplorerError,
    );
  });
});

describe("NodeReal / BSC RPC log discovery", () => {
  const TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const pad = (address: string) => `0x${address.toLowerCase().slice(2).padStart(64, "0")}`;
  const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;
  const SENDER = "0x1111111111111111111111111111111111111111";

  function fakeRpc(options: {
    latest: number;
    blockTime: (block: number) => number;
    logs: (from: number, to: number) => unknown[];
    maxRange?: number;
    calls?: Array<{ method: string; params: unknown[] }>;
  }): typeof fetch {
    return (async (_url: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      options.calls?.push(body);
      const reply = (payload: unknown) =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, ...(payload as object) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      if (body.method === "eth_blockNumber") return reply({ result: `0x${options.latest.toString(16)}` });
      if (body.method === "eth_getBlockByNumber") {
        const block = Number(BigInt(body.params[0] as string));
        return reply({ result: { timestamp: `0x${options.blockTime(block).toString(16)}` } });
      }
      if (body.method === "eth_getLogs") {
        const filter = body.params[0] as { fromBlock: string; toBlock: string };
        const from = Number(BigInt(filter.fromBlock));
        const to = Number(BigInt(filter.toBlock));
        if (options.maxRange && to - from + 1 > options.maxRange) {
          return reply({ error: { code: -32005, message: "block range too large" } });
        }
        return reply({ result: options.logs(from, to) });
      }
      return reply({ error: { code: -32601, message: "method not found" } });
    }) as typeof fetch;
  }

  const base = 1_800_000_000;
  const blockTime = (block: number) => base + block; // 1 block per second

  it("finds the wallet's USDT Transfer logs from the configured contract only", async () => {
    const calls: Array<{ method: string; params: unknown[] }> = [];
    const provider = new RpcLogTransferProvider({
      rpcUrl: "https://bsc-mainnet.nodereal.example.invalid/v1/key",
      wallet: WALLET,
      tokenContract: CONTRACT,
      initialChunkBlocks: 1000,
      fetchImpl: fakeRpc({
        latest: 10_000,
        blockTime,
        calls,
        logs: (from, to) =>
          [
            {
              transactionHash: TX_HASH,
              blockNumber: "0x2328", // 9000
              address: CONTRACT,
              topics: [TOPIC, pad(SENDER), pad(WALLET)],
              data: word(28_581_700_000_000_000_000n),
            },
            {
              // Fake token with the same amount: must be ignored.
              transactionHash: TX_HASH_2,
              blockNumber: "0x2329",
              address: SENDER,
              topics: [TOPIC, pad(SENDER), pad(WALLET)],
              data: word(28_581_700_000_000_000_000n),
            },
          ].filter((log) => {
            const block = Number(BigInt(log.blockNumber));
            return block >= from && block <= to;
          }),
      }),
    });

    const result = await provider.findTokenTransfers({ since: new Date((base + 8_000) * 1000) });
    expect(result.truncated).toBe(false);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]?.hash).toBe(TX_HASH);
    expect(result.transfers[0]?.valueRaw).toBe("28581700000000000000");
    const logCall = calls.find((call) => call.method === "eth_getLogs");
    const filter = logCall?.params[0] as { address: string; topics: unknown[] };
    expect(filter.address).toBe(CONTRACT);
    expect(filter.topics[2]).toBe(pad(WALLET));
  });

  it("shrinks the block window when the RPC refuses a large range", async () => {
    const provider = new RpcLogTransferProvider({
      rpcUrl: "https://bsc-mainnet.nodereal.example.invalid/v1/key",
      wallet: WALLET,
      tokenContract: CONTRACT,
      initialChunkBlocks: 4000,
      fetchImpl: fakeRpc({ latest: 5_000, blockTime, maxRange: 500, logs: () => [] }),
    });
    const result = await provider.findTokenTransfers({ since: new Date((base + 3_000) * 1000) });
    expect(result.transfers).toHaveLength(0);
    expect(result.truncated).toBe(false);
  });

  it("reports rate limits as an outage, never as an empty wallet", async () => {
    const provider = new RpcLogTransferProvider({
      rpcUrl: "https://bsc-mainnet.nodereal.example.invalid/v1/key",
      wallet: WALLET,
      tokenContract: CONTRACT,
      fetchImpl: (async () => new Response("", { status: 429 })) as typeof fetch,
    });
    await expect(provider.findTokenTransfers({ since: new Date(0) })).rejects.toMatchObject({
      kind: "rate_limited",
    });
  });
});

describe("crypto payment lifecycle", () => {
  let handle: DatabaseHandle;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.PAYMENT_WALLET = WALLET;
    process.env.PAYMENT_TOKEN_CONTRACT = CONTRACT;
    process.env.PAYMENT_CHAIN_ID = "56";
    process.env.BNB_RPC_URL = "https://rpc.example.invalid";
    handle = await makeTestDb();
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    await handle.close();
  });

  it("creates a real payment record with a unique exact amount and 30-minute expiry", async () => {
    const created = await makeCryptoOrder(handle, "crypto-create");
    const db = handle.db;
    const rows = await db
      .select()
      .from(cryptoPayments)
      .where(eq(cryptoPayments.id, created.cryptoId))
      .limit(1);
    const payment = rows[0]!;
    expect(payment.status).toBe("pending");
    expect(payment.chainId).toBe(56);
    expect(payment.tokenContract).toBe(CONTRACT);
    expect(payment.receivingAddress).toBe(WALLET);
    expect(payment.originalAmountMinor).toBeGreaterThan(0);
    expect(payment.originalCurrency).toBe("USD");
    expect(payment.amountRaw).toMatch(/^\d+$/);
    expect(parseTokenAmount(payment.amountUsdt)).toBe(parseRawAmountFromDb(payment.amountRaw));
    expect(payment.expiresAt.getTime() - payment.createdAt.getTime()).toBe(30 * 60 * 1000);

    const repeated = await createCryptoPayment(db, {
      orderId: created.orderId,
      amountMinor: payment.originalAmountMinor,
      currency: "USD",
    });
    expect(repeated.cryptoPaymentId).toBe(created.cryptoId);
  });

  it("reserves different exact amounts for different orders", async () => {
    const first = await makeCryptoOrder(handle, "crypto-unique-1");
    const second = await makeCryptoOrder(handle, "crypto-unique-2");
    const third = await makeCryptoOrder(handle, "crypto-unique-3");
    expect(new Set([first.amountRaw, second.amountRaw, third.amountRaw]).size).toBe(3);
  });

  it("does not mark paid before 15 confirmations, then reuses existing fulfillment", async () => {
    const created = await makeCryptoOrder(handle, "crypto-paid");
    const rpc = new FakeRpc();
    const explorer = new FakeExplorer();
    const now = new Date(created.createdAt.getTime() + 60_000);
    const blockTime = new Date(created.createdAt.getTime() + 5_000);
    explorer.transfers = [
      transferFor({
        hash: TX_HASH,
        amountRaw: created.amountRaw,
        blockNumber: 100,
        blockTime,
      }),
    ];
    registerTransfer(rpc, {
      hash: TX_HASH,
      amountRaw: created.amountRaw,
      blockNumber: 100,
      blockTime,
    });
    rpc.latestBlock = 113;

    const confirming = await verifyCryptoPayment(handle.db, created.cryptoId, {
      config: TEST_CONFIG,
      explorer,
      rpc,
      now,
    });
    expect(confirming.status).toBe("confirming");
    expect(confirming.confirmations).toBe(14);
    expect(await orderEsimCount(handle, created.orderId)).toBe(0);

    rpc.latestBlock = 114;
    const paid = await verifyCryptoPayment(handle.db, created.cryptoId, {
      config: TEST_CONFIG,
      explorer,
      rpc,
      now: new Date(now.getTime() + 60_000),
    });
    expect(paid.status).toBe("paid");
    expect(paid.txHash).toBe(TX_HASH);
    expect(paid.confirmations).toBe(15);

    const orderRows = await handle.db
      .select()
      .from(orders)
      .where(eq(orders.id, created.orderId))
      .limit(1);
    expect(orderRows[0]?.paymentStatus).toBe("paid");
    expect(orderRows[0]?.fulfillmentStatus).toBe("delivered");
    expect(await orderEsimCount(handle, created.orderId)).toBe(1);

    const repeated = await verifyCryptoPayment(handle.db, created.cryptoId, {
      config: TEST_CONFIG,
      explorer,
      rpc,
      now: new Date(now.getTime() + 120_000),
    });
    expect(repeated.status).toBe("paid");
    expect(await orderEsimCount(handle, created.orderId)).toBe(1);
  });

  it("expires a request with no matching transfer and does not fulfill it", async () => {
    const created = await makeCryptoOrder(handle, "crypto-expired");
    const rpc = new FakeRpc();
    const explorer = new FakeExplorer();
    const result = await verifyCryptoPayment(handle.db, created.cryptoId, {
      config: TEST_CONFIG,
      explorer,
      rpc,
      now: new Date(created.expiresAt.getTime() + 60_000),
    });
    expect(result.status).toBe("expired");
    expect(await orderEsimCount(handle, created.orderId)).toBe(0);
    const orderRows = await handle.db
      .select()
      .from(orders)
      .where(eq(orders.id, created.orderId))
      .limit(1);
    expect(orderRows[0]?.paymentStatus).toBe("pending");
  });

  it("preserves a late payment for manual review without fulfilling the order", async () => {
    const created = await makeCryptoOrder(handle, "crypto-late");
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expiry = new Date(past.getTime() + 30 * 60 * 1000);
    await handle.db
      .update(orders)
      .set({ createdAt: past })
      .where(eq(orders.id, created.orderId));
    await handle.db
      .update(cryptoPayments)
      .set({ createdAt: past, expiresAt: expiry })
      .where(eq(cryptoPayments.id, created.cryptoId));

    const rpc = new FakeRpc();
    const explorer = new FakeExplorer();
    const blockTime = new Date(expiry.getTime() + 60_000);
    explorer.transfers = [
      transferFor({
        hash: LATE_TX_HASH,
        amountRaw: created.amountRaw,
        blockNumber: 100,
        blockTime,
      }),
    ];
    registerTransfer(rpc, {
      hash: LATE_TX_HASH,
      amountRaw: created.amountRaw,
      blockNumber: 100,
      blockTime,
    });
    rpc.latestBlock = 114;

    const result = await verifyCryptoPayment(handle.db, created.cryptoId, {
      config: TEST_CONFIG,
      explorer,
      rpc,
      now: new Date(),
    });
    expect(result.status).toBe("late_payment");
    expect(result.txHash).toBe(LATE_TX_HASH);
    expect(await orderEsimCount(handle, created.orderId)).toBe(0);
    const orderRows = await handle.db
      .select()
      .from(orders)
      .where(eq(orders.id, created.orderId))
      .limit(1);
    expect(orderRows[0]?.paymentStatus).toBe("pending");
  });

  it("moves ambiguous matching transfers to manual review", async () => {
    const created = await makeCryptoOrder(handle, "crypto-ambiguous");
    const rpc = new FakeRpc();
    const explorer = new FakeExplorer();
    const blockTime = new Date(created.createdAt.getTime() + 5_000);
    explorer.transfers = [
      transferFor({
        hash: AMBIGUOUS_TX_HASH,
        amountRaw: created.amountRaw,
        blockNumber: 100,
        blockTime,
      }),
      transferFor({
        hash: AMBIGUOUS_TX_HASH_2,
        amountRaw: created.amountRaw,
        blockNumber: 101,
        blockTime,
      }),
    ];
    const result = await verifyCryptoPayment(handle.db, created.cryptoId, {
      config: TEST_CONFIG,
      explorer,
      rpc,
      now: new Date(created.createdAt.getTime() + 60_000),
    });
    expect(result.status).toBe("manual_review");
    expect(result.txHash).toBeNull();
    expect(await orderEsimCount(handle, created.orderId)).toBe(0);
  });

  it("refuses to reuse a transaction hash already assigned to another order", async () => {
    const first = await makeCryptoOrder(handle, "crypto-duplicate-1");
    const firstRpc = new FakeRpc();
    const firstExplorer = new FakeExplorer();
    const firstBlockTime = new Date(first.createdAt.getTime() + 5_000);
    firstExplorer.transfers = [
      transferFor({
        hash: DUPLICATE_TX_HASH,
        amountRaw: first.amountRaw,
        blockNumber: 100,
        blockTime: firstBlockTime,
      }),
    ];
    registerTransfer(firstRpc, {
      hash: DUPLICATE_TX_HASH,
      amountRaw: first.amountRaw,
      blockNumber: 100,
      blockTime: firstBlockTime,
    });
    firstRpc.latestBlock = 114;
    const firstResult = await verifyCryptoPayment(handle.db, first.cryptoId, {
      config: TEST_CONFIG,
      explorer: firstExplorer,
      rpc: firstRpc,
      now: new Date(first.createdAt.getTime() + 60_000),
    });
    expect(firstResult.status).toBe("paid");

    const second = await makeCryptoOrder(handle, "crypto-duplicate-2");
    const secondRpc = new FakeRpc();
    const secondExplorer = new FakeExplorer();
    const secondBlockTime = new Date(second.createdAt.getTime() + 5_000);
    secondExplorer.transfers = [
      transferFor({
        hash: DUPLICATE_TX_HASH,
        amountRaw: second.amountRaw,
        blockNumber: 200,
        blockTime: secondBlockTime,
      }),
    ];
    registerTransfer(secondRpc, {
      hash: DUPLICATE_TX_HASH,
      amountRaw: second.amountRaw,
      blockNumber: 200,
      blockTime: secondBlockTime,
    });
    secondRpc.latestBlock = 214;
    const secondResult = await verifyCryptoPayment(handle.db, second.cryptoId, {
      config: TEST_CONFIG,
      explorer: secondExplorer,
      rpc: secondRpc,
      now: new Date(second.createdAt.getTime() + 60_000),
    });
    expect(secondResult.status).toBe("manual_review");
    expect(secondResult.txHash).toBeNull();
    const secondRow = await getCryptoPaymentByOrderId(handle.db, second.orderId);
    expect(secondRow?.txHash).toBeNull();
    expect(await orderEsimCount(handle, second.orderId)).toBe(0);
  });

  it("verifies a customer-supplied hash without explorer discovery", async () => {
    const created = await makeCryptoOrder(handle, "crypto-fallback");
    const rpc = new FakeRpc();
    const blockTime = new Date(created.createdAt.getTime() + 5_000);
    registerTransfer(rpc, {
      hash: FALLBACK_TX_HASH,
      amountRaw: created.amountRaw,
      blockNumber: 100,
      blockTime,
    });
    rpc.latestBlock = 114;
    // An explorer that would throw if called: the fallback must use RPC only.
    const unavailableExplorer: ExplorerProvider = {
      name: "unavailable",
      findTokenTransfers: async () => {
        throw new Error("explorer must not be called");
      },
    };
    const result = await verifyCryptoPayment(handle.db, created.cryptoId, {
      config: TEST_CONFIG,
      explorer: unavailableExplorer,
      rpc,
      submittedTxHash: FALLBACK_TX_HASH,
      now: new Date(created.createdAt.getTime() + 60_000),
    });
    expect(result.status).toBe("paid");
    expect(result.txHash).toBe(FALLBACK_TX_HASH);
    expect(await orderEsimCount(handle, created.orderId)).toBe(1);
  });
});

const requiredProductionKeys: TranslationKey[] = [
  "checkout.cryptoPageMetaTitle",
  "checkout.cryptoPageMetaDescription",
  "checkout.cryptoPaymentTitle",
  "checkout.cryptoPaymentLead",
  "checkout.cryptoUnavailableNote",
  "checkout.cryptoOrderNote",
  "checkout.cryptoSendExactly",
  "checkout.cryptoAmountNote",
  "checkout.cryptoCopyAmount",
  "checkout.cryptoCopied",
  "checkout.cryptoCopyFailed",
  "checkout.cryptoOrderLabel",
  "checkout.cryptoReferenceLabel",
  "checkout.cryptoAssetLabel",
  "checkout.cryptoChainIdLabel",
  "checkout.cryptoConfirmationsRequired",
  "checkout.cryptoQrAlt",
  "checkout.cryptoQrNote",
  "checkout.cryptoCopyWallet",
  "checkout.cryptoCopyContract",
  "checkout.cryptoNetworkWarningTitle",
  "checkout.cryptoNetworkWarning",
  "checkout.cryptoCountdownLabel",
  "checkout.cryptoExpired",
  "checkout.cryptoCheckNow",
  "checkout.cryptoChecking",
  "checkout.cryptoStatusPending",
  "checkout.cryptoStatusPendingNote",
  "checkout.cryptoStatusConfirming",
  "checkout.cryptoStatusConfirmingNote",
  "checkout.cryptoStatusPaid",
  "checkout.cryptoStatusPaidNote",
  "checkout.cryptoStatusExpired",
  "checkout.cryptoStatusExpiredNote",
  "checkout.cryptoStatusLate",
  "checkout.cryptoStatusLateNote",
  "checkout.cryptoStatusManualReview",
  "checkout.cryptoStatusManualReviewNote",
  "checkout.cryptoStatusError",
  "checkout.cryptoStatusErrorNote",
  "checkout.cryptoConfirmationsLabel",
  "checkout.cryptoConfirmationsProgress",
  "checkout.cryptoPaidTitle",
  "checkout.cryptoPaidBody",
  "checkout.cryptoPaidAt",
  "checkout.cryptoViewOrder",
  "checkout.cryptoTxHashLabel",
  "checkout.cryptoViewOnBscScan",
  "checkout.cryptoAutoDetectNote",
  "checkout.cryptoRateLimited",
  "checkout.cryptoUnavailableError",
  "checkout.cryptoNotFoundError",
  "checkout.cryptoRequestFailed",
  "checkout.cryptoTransactionFailed",
  "checkout.cryptoTxHashFieldLabel",
  "checkout.cryptoTxHashPlaceholder",
  "checkout.cryptoTxHashNote",
  "checkout.cryptoTxHashInvalid",
  "checkout.cryptoSubmitTx",
  "checkout.cryptoInstructionNetwork",
  "checkout.cryptoInstructionExact",
  "checkout.cryptoInstructionFees",
  "checkout.cryptoInstructionSupport",
  "checkout.cryptoKeepOpen",
  "checkout.cryptoWalletHelpTitle",
  "checkout.cryptoWalletHelpBody",
  "checkout.cryptoNoAutoAmountNote",
  "checkout.cryptoRequiredConfirmationsNote",
];

describe("crypto payment translations", () => {
  it("provides every production key in every locale", () => {
    for (const code of ["en", "es", "ar", "fr"] as const) {
      const dictionary = dictionaries[code];
      for (const key of requiredProductionKeys) {
        expect(dictionary[key]?.trim().length, `${code}:${key}`).toBeGreaterThan(0);
      }
      expect(Object.keys(dictionary).length, code).toBe(Object.keys(dictionaries.en).length);
    }
  });

  it("keeps the critical English disclosures explicit", () => {
    expect(en["checkout.cryptoStatusPaidNote"]).toContain("verified");
    expect(en["checkout.cryptoRequiredConfirmationsNote"]).toContain("{count}");
    expect(en["checkout.cryptoAmountNote"]).toContain("last four decimals");
    expect(en["checkout.cryptoQrNote"]).toContain("not filled in automatically");
    expect(en["checkout.cryptoNetworkWarning"]).toContain("permanent loss");
    expect(en["checkout.cryptoTransactionFailed"]).toContain("does not match");
  });
});
