import { sha256Hex } from "@/lib/crypto";
import type {
  CreateSupplierOrderInput,
  SupplierAdapter,
  SupplierEsim,
  SupplierHealth,
  SupplierOrder,
} from "@/lib/integrations/supplier/types";

function deterministicDigits(seed: string, length: number): string {
  const hash = sha256Hex(seed);
  let digits = "";
  for (let i = 0; i < hash.length && digits.length < length; i += 1) {
    digits += (parseInt(hash[i], 16) % 10).toString();
  }
  return digits.padEnd(length, "0").slice(0, length);
}

export class MockSupplierAdapter implements SupplierAdapter {
  readonly key = "mock";
  readonly mode = "sandbox" as const;
  readonly isMock = true;
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
      throw new Error("MOCK_SUPPLIER_FAIL_ONCE: simulated transient supplier failure");
    }
    if (!input.transactionId || !input.productId) {
      throw new Error("Mock supplier requires transactionId and productId");
    }
    return this.orderFor(input.transactionId);
  }

  async getOrder(supplierOrderId: string): Promise<SupplierOrder> {
    const existing = this.orders.get(supplierOrderId);
    if (existing) return existing;
    if (!supplierOrderId.startsWith("mock_ord_")) {
      throw new Error("Unknown mock supplier order");
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
}
