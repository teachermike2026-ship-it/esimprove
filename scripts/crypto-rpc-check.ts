/**
 * READ-ONLY crypto payment health check (npm run crypto:check).
 *
 * Uses ESIMPROVE's real discovery and verifier against BNB Smart Chain
 * mainnet through the configured BNB_RPC_URL:
 *  - checks chain, token contract and RPC connectivity;
 *  - replays an existing USDT transfer between third parties to prove that
 *    discovery and verification parse real chain data (and reject the wrong
 *    amount, wallet, token and chain);
 *  - lists how many USDT transfers reached the receiving wallet in 24 h.
 * It never sends a transaction, never writes to a database, and never prints
 * the RPC URL or API key.
 */
import { loadLocalEnv } from "./env";
loadLocalEnv();

async function main() {
  const { loadCryptoPaymentConfig } = await import("../lib/payments/crypto/config");
  const { HttpBnbRpcClient, verifyBnbTransfer, TRANSFER_EVENT_TOPIC } = await import(
    "../lib/payments/crypto/bnb-verifier"
  );
  const { RpcLogTransferProvider } = await import("../lib/payments/crypto/rpc-log-provider");
  const config = loadCryptoPaymentConfig();
  if (!config) throw new Error("crypto config invalid");
  console.log("crypto config valid:", true, "| fallback RPC configured:", Boolean(config.rpcFallbackUrl));

  const rpc = new HttpBnbRpcClient({ url: config.rpcUrl });
  const latest = await rpc.getLatestBlockNumber();
  // Pick a real USDT transfer from ~200 blocks ago (well past 15 confirmations).
  const target = latest - 200;
  const res = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [{ fromBlock: "0x" + target.toString(16), toBlock: "0x" + target.toString(16), address: config.tokenContract, topics: [TRANSFER_EVENT_TOPIC] }],
    }),
  });
  const logs = ((await res.json()) as { result: Array<{ transactionHash: string; topics: string[]; data: string }> }).result;
  const sample = logs.find((log) => log.topics.length === 3 && BigInt(log.data) > 0n);
  if (!sample) throw new Error("no sample transfer found");
  const recipient = "0x" + sample.topics[2]!.slice(26);
  const amount = BigInt(sample.data);
  console.log("sample block:", target, "| transfers in block:", logs.length);

  // 1) Discovery with ESIMPROVE's provider, treating the stranger's address as "wallet".
  const blockTime = await rpc.getBlockTimestamp(target);
  const provider = new RpcLogTransferProvider({ rpcUrl: config.rpcUrl, wallet: recipient, tokenContract: config.tokenContract });
  const scan = await provider.findTokenTransfers({ since: new Date(blockTime!.getTime() - 5000), until: new Date(blockTime!.getTime() + 5000) });
  const found = scan.transfers.some((t) => t.hash.toLowerCase() === sample.transactionHash.toLowerCase() && t.valueRaw === amount.toString());
  console.log("discovery found the real transfer:", found, "| requests:", scan.pagesScanned, "| truncated:", scan.truncated);

  // 2) Independent verification with the exact amount -> must be verified.
  const ok = await verifyBnbTransfer(rpc, sample.transactionHash, {
    tokenContract: config.tokenContract, wallet: recipient, amountRaw: amount, requiredConfirmations: 15, expectedChainId: 56,
  });
  console.log("verify exact amount:", ok.outcome, ok.outcome === "verified" ? `(confirmations ${ok.settlement.confirmations})` : "");

  // 3) Same transaction, wrong amount / wrong wallet / wrong token -> must be rejected.
  const wrongAmount = await verifyBnbTransfer(rpc, sample.transactionHash, {
    tokenContract: config.tokenContract, wallet: recipient, amountRaw: amount + 1n, requiredConfirmations: 15, expectedChainId: 56,
  });
  const wrongWallet = await verifyBnbTransfer(rpc, sample.transactionHash, {
    tokenContract: config.tokenContract, wallet: config.wallet, amountRaw: amount, requiredConfirmations: 15, expectedChainId: 56,
  });
  const wrongToken = await verifyBnbTransfer(rpc, sample.transactionHash, {
    tokenContract: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", wallet: recipient, amountRaw: amount, requiredConfirmations: 15, expectedChainId: 56,
  });
  const wrongChain = await verifyBnbTransfer(rpc, sample.transactionHash, {
    tokenContract: config.tokenContract, wallet: recipient, amountRaw: amount, requiredConfirmations: 15, expectedChainId: 97,
  });
  console.log("wrong amount:", wrongAmount.outcome, "| wrong wallet:", wrongWallet.outcome, "| wrong token:", wrongToken.outcome, "| wrong chain:", wrongChain.outcome);

  // 4) ESIMPROVE's own receiving wallet: discovery over the last ~24 h (read-only).
  const own = new RpcLogTransferProvider({ rpcUrl: config.rpcUrl, wallet: config.wallet, tokenContract: config.tokenContract });
  const ownScan = await own.findTokenTransfers({ since: new Date(Date.now() - 24 * 60 * 60 * 1000) });
  console.log("own wallet USDT transfers in last 24h:", ownScan.transfers.length, "| eth_getLogs requests:", ownScan.pagesScanned, "| truncated:", ownScan.truncated);
}
main().catch((e) => console.log("FAILED:", (e as Error).name, String((e as Error).message).replace(/https?:\/\/\S+/g, "[url]").slice(0, 200)));
