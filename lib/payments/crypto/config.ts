/**
 * Server-only configuration for the crypto payment integration.
 *
 * All values are read from the process environment. Nothing here is exposed to
 * the browser through NEXT_PUBLIC_ variables, and the API key / RPC URL are
 * never passed to React components.
 */

export const CRYPTO_PAYMENT_CONSTANTS = {
  network: "BNB Smart Chain",
  standard: "BEP-20",
  chainId: 56,
  tokenDecimals: 18,
  tokenContract: "0x55d398326f99059fF775485246999027B3197955",
  defaultWallet: "0xBF93e7123FfEf0973d469F6Ce39D201dC2e5Aa5E",
  asset: "Binance-Peg USDT (BEP-20)",
  assetSymbol: "USDT",
  confirmationsRequired: 15,
  paymentWindowMinutes: 30,
  verificationIntervalSeconds: 15,
  /** Default RPC provider: NodeReal MegaNode (https://dashboard.nodereal.io/api-key). */
  rpcProviderName: "NodeReal MegaNode",
  bscScanTxBaseUrl: "https://bscscan.com/tx/",
  /**
   * How long after expiry the worker keeps scanning for a late transfer. The
   * payment record is retained forever; this only bounds automatic detection.
   */
  latePaymentWindowHours: 24,
} as const;

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export interface CryptoPaymentConfig {
  wallet: string;
  tokenContract: string;
  chainId: number;
  /** Full NodeReal (or other BSC) HTTPS endpoint. It embeds the API key: server-only. */
  rpcUrl: string;
  /**
   * Optional second BSC JSON-RPC endpoint used for verification reads when the
   * primary fails (for example https://bsc-dataseed.bnbchain.org). Public
   * endpoints disable eth_getLogs, so discovery always uses the primary.
   */
  rpcFallbackUrl: string | null;
  confirmationsRequired: number;
  paymentWindowMinutes: number;
  verificationIntervalSeconds: number;
  tokenDecimals: number;
  network: string;
  standard: string;
  asset: string;
  assetSymbol: string;
  bscScanTxBaseUrl: string;
  latePaymentWindowHours: number;
}

export interface PublicCryptoPaymentConfig {
  wallet: string;
  tokenContract: string;
  chainId: number;
  confirmationsRequired: number;
  paymentWindowMinutes: number;
  verificationIntervalSeconds: number;
  tokenDecimals: number;
  network: string;
  standard: string;
  asset: string;
  assetSymbol: string;
  bscScanTxBaseUrl: string;
}

export type CryptoConfigResult =
  | { ok: true; config: CryptoPaymentConfig; problems: [] }
  | { ok: false; config: null; problems: string[] };

function envValue(env: NodeJS.ProcessEnv, name: string): string {
  return (env[name] ?? "").trim();
}

export function isEvmAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value);
}

/** True when at least one crypto variable is present, so partial config fails closed. */
export function cryptoConfigurationRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  return [
    "PAYMENT_WALLET",
    "BNB_RPC_URL",
    "PAYMENT_TOKEN_CONTRACT",
    "PAYMENT_CHAIN_ID",
  ].some((name) => envValue(env, name) !== "");
}

/**
 * Validate the complete crypto configuration without throwing. Values are never
 * included in the returned problems so they are safe to log.
 */
export function validateCryptoPaymentConfig(
  env: NodeJS.ProcessEnv = process.env,
): CryptoConfigResult {
  const problems: string[] = [];

  const wallet = envValue(env, "PAYMENT_WALLET");
  if (!wallet) {
    problems.push("PAYMENT_WALLET is required");
  } else if (!isEvmAddress(wallet)) {
    problems.push("PAYMENT_WALLET must be a 20-byte 0x-prefixed EVM address");
  } else if (wallet.toLowerCase() !== CRYPTO_PAYMENT_CONSTANTS.defaultWallet.toLowerCase()) {
    // The receiving wallet is part of the reviewed payment configuration.
    // Refuse a different address instead of silently accepting funds elsewhere.
    problems.push("PAYMENT_WALLET must be the documented receiving wallet");
  }

  const tokenContract = envValue(env, "PAYMENT_TOKEN_CONTRACT");
  if (!tokenContract) {
    problems.push("PAYMENT_TOKEN_CONTRACT is required");
  } else if (!isEvmAddress(tokenContract)) {
    problems.push("PAYMENT_TOKEN_CONTRACT must be a 20-byte 0x-prefixed EVM address");
  } else if (
    tokenContract.toLowerCase() !== CRYPTO_PAYMENT_CONSTANTS.tokenContract.toLowerCase()
  ) {
    problems.push(
      "PAYMENT_TOKEN_CONTRACT must be the documented Binance-Peg BSC-USD contract",
    );
  }

  const chainRaw = envValue(env, "PAYMENT_CHAIN_ID");
  const chainId = Number(chainRaw);
  if (!chainRaw) {
    problems.push("PAYMENT_CHAIN_ID is required");
  } else if (!Number.isSafeInteger(chainId) || chainId !== CRYPTO_PAYMENT_CONSTANTS.chainId) {
    problems.push("PAYMENT_CHAIN_ID must be 56 (BNB Smart Chain)");
  }

  const rpcUrl = envValue(env, "BNB_RPC_URL");
  if (!rpcUrl) {
    problems.push("BNB_RPC_URL is required");
  } else {
    try {
      const parsed = new URL(rpcUrl);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
        // The endpoint carries the NodeReal API key, so it must use TLS.
        problems.push("BNB_RPC_URL must be an https URL");
      }
    } catch {
      problems.push("BNB_RPC_URL must be a valid absolute URL");
    }
    if ((rpcUrl.match(/:\/\//g) ?? []).length > 1) {
      // Seen in practice: the endpoint pasted after the provider prefix
      // (https://.../v1/https://.../v1/<key>), which makes every call fail.
      problems.push("BNB_RPC_URL contains the URL twice; use exactly the endpoint shown by the provider");
    }
  }

  const rpcFallbackRaw = envValue(env, "BNB_RPC_FALLBACK_URL");
  let rpcFallbackUrl: string | null = null;
  if (rpcFallbackRaw) {
    try {
      const parsed = new URL(rpcFallbackRaw);
      if (parsed.protocol !== "https:") problems.push("BNB_RPC_FALLBACK_URL must be an https URL");
      else rpcFallbackUrl = rpcFallbackRaw;
    } catch {
      problems.push("BNB_RPC_FALLBACK_URL must be a valid absolute URL");
    }
  }

  if (!isEvmAddress(CRYPTO_PAYMENT_CONSTANTS.defaultWallet)) {
    problems.push("Internal crypto configuration is invalid");
  }

  if (problems.length > 0) return { ok: false, config: null, problems };

  return {
    ok: true,
    problems: [],
    config: {
      wallet,
      tokenContract,
      chainId,
      rpcUrl,
      rpcFallbackUrl,
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
    },
  };
}

export function loadCryptoPaymentConfig(
  env: NodeJS.ProcessEnv = process.env,
): CryptoPaymentConfig | null {
  const result = validateCryptoPaymentConfig(env);
  return result.ok ? result.config : null;
}

export function assertCryptoPaymentConfig(
  env: NodeJS.ProcessEnv = process.env,
): CryptoPaymentConfig {
  const result = validateCryptoPaymentConfig(env);
  if (!result.ok) {
    throw new Error(`Crypto payment configuration is incomplete: ${result.problems.join("; ")}`);
  }
  return result.config;
}

/** Safe projection for the payment page. Contains no secrets. */
export function publicCryptoPaymentConfig(
  config: CryptoPaymentConfig,
): PublicCryptoPaymentConfig {
  return {
    wallet: config.wallet,
    tokenContract: config.tokenContract,
    chainId: config.chainId,
    confirmationsRequired: config.confirmationsRequired,
    paymentWindowMinutes: config.paymentWindowMinutes,
    verificationIntervalSeconds: config.verificationIntervalSeconds,
    tokenDecimals: config.tokenDecimals,
    network: config.network,
    standard: config.standard,
    asset: config.asset,
    assetSymbol: config.assetSymbol,
    bscScanTxBaseUrl: config.bscScanTxBaseUrl,
  };
}
