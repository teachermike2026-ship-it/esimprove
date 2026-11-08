import { sha256Hex } from "@/lib/crypto";
import {
  DEFAULT_RETRY_POLICY,
  ProviderError,
  type CreateSupplierOrderInput,
  type RetryPolicy,
  type SupplierAdapter,
  type SupplierCapabilities,
  type SupplierCatalogEntry,
  type SupplierEsim,
  type SupplierHealth,
  type SupplierOrder,
} from "@/lib/integrations/supplier/types";

function deterministicDigits(seed: string, length: number): string {
  const hash = sha256Hex(seed);
  let digits = "";
  for (let i = 0; i < hash.length && digits.length < length; i += 1) {
    digits += (parseInt(hash[i], 16) % 10).toString();
  }
  return digits.padEnd(length, "0").slice(0, length);
}

export class MockSupplierAdapter implements SupplierAdapter {  readonly key = "mock";
  readonly mode = "sandbox" as const;
  readonly isMock = true;
  readonly capabilities: SupplierCapabilities = {
    fetchCatalog: true,
    fetchDestinations: true,
    fetchPlanDetails: true,
    checkAvailability: true,
    createOrder: true,
    retrieveOrderStatus: true,
    retrieveEsimCredentials: true,
    retrieveUsage: false,
    topUp: false,
    requestCancelOrRefund: false,
    retrieveBalance: false,
  };
  readonly retry: RetryPolicy = DEFAULT_RETRY_POLICY;
  readonly timeoutMs = 10_000;
  readonly apiVersion = "mock-v1";
  private attempts = 0;
  private readonly failFirstAttempt: boolean;
  private readonly orders = new Map<string, SupplierOrder>();

  constructor(options: { failFirstAttempt?: boolean } = {}) {
    this.failFirstAttempt = Boolean(options.failFirstAttempt);
  }

  private orderFor(transactionId: string): SupplierOrder {
    const supplierOrderId = `mock_ord_${sha256Hex(transactionId).slice(0, 16)}`;
    const iccid = `89${deterministicDigits(transactionId, 18)}`;
    const suffix = sha256Hex(transactionId).slice(0, 10).toUpperCase();
    const esim: SupplierEsim = {
      supplierEsimId: `mock_esim_${suffix}`,
      iccid,
      lpa: `LPA:1$rsp.demo.invalid$DEMO-${suffix}`,
      smdpAddress: "rsp.demo.invalid",
      matchingId: `DEMO-${suffix}`,
      status: "ready_to_install",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    const order: SupplierOrder = {
      supplierOrderId,
      status: "ready",
      esims: [esim],
      raw: {
        label: "MOCK SUPPLIER RESPONSE — NOT A REAL ESIM",
        transactionId,
        note: "The LPA uses the reserved .invalid domain and cannot connect to a network.",
      },
    };
    this.orders.set(supplierOrderId, order);
    return order;
  }

  async createOrder(input: CreateSupplierOrderInput): Promise<SupplierOrder> {
    this.attempts += 1;
    if (this.failFirstAttempt && this.attempts === 1) {
      throw new ProviderError(
        "transient_supplier_failure",
        "MOCK_SUPPLIER_FAIL_ONCE: simulated transient supplier failure",
        true,
      );
    }
    if (!input.transactionId || !input.productId) {
      throw new ProviderError("invalid_request", "Mock supplier requires transactionId and productId", false);
    }
    return this.orderFor(input.transactionId);
  }

  async getOrder(supplierOrderId: string): Promise<SupplierOrder> {
    const existing = this.orders.get(supplierOrderId);
    if (existing) return existing;
    if (!supplierOrderId.startsWith("mock_ord_")) {
      throw new ProviderError("not_found", "Unknown mock supplier order", false);
    }
    return this.orderFor(supplierOrderId);
  }

  async getEsims(supplierOrderId: string): Promise<SupplierEsim[]> {
    return (await this.getOrder(supplierOrderId)).esims;
  }

  async healthCheck(): Promise<SupplierHealth> {
    return {
      ok: true,
      message: "Mock supplier sandbox is available. No network or supplier account is used.",
      checkedAt: new Date(),
    };
  }

  static toProviderError(error: unknown): ProviderError {
    if (error instanceof ProviderError) return error;
    const message = error instanceof Error ? error.message : String(error);
    const retryable = /timed(ea|ed)?\s*out|timeout|ECONNRESET|ETIMEDOUT|ECONNREFUSED|503|429|transient|fail_once/i.test(
      message,
    );
    return new ProviderError(retryable ? "transient_supplier_failure" : "provider_error", message, retryable);
  }

  async fetchCatalog(): Promise<SupplierCatalogEntry[]> {
    const now = Date.now();
    const base = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const entries: SupplierCatalogEntry[] = [
      {
        supplierProductId: "mock_par_tokyo_5g_10",
        planName: "Tokyo Express 5G · 10 GB",
        dataMb: 10_000,
        validityDays: 30,
        costMinor: 420,
        currency: "USD",
        coverageSummary: "Nationwide 4G/5G data in Japan.",
        networkSummary: "Demo network pool",
        destinationSlug: "japan",
      },
      {
        supplierProductId: "mock_par_paris_2g_5",
        planName: "Paris City Break 2G · 5 GB",
        dataMb: 5_000,
        validityDays: 15,
        costMinor: 350,
        currency: "USD",
        coverageSummary: "City-level data in France.",
        networkSummary: "Demo network pool",
        destinationSlug: "france",
      },
    ];
    return entries.map((entry, index) => ({
      ...entry,
      effectiveAt: new Date(base.getTime() + index * 86_400_000),
    }));
  }
}
