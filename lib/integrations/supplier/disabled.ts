import {
  IntegrationDisabledError,
  type CreateSupplierOrderInput,
  type SupplierAdapter,
  type SupplierCapabilities,
  type SupplierEsim,
  type SupplierHealth,
  type SupplierOrder,
  type RetryPolicy,
} from "@/lib/integrations/supplier/types";

export class DisabledLiveSupplierAdapter implements SupplierAdapter {
  readonly key = "esim_access";
  readonly mode = "live" as const;
  readonly isMock = false;
  readonly capabilities: SupplierCapabilities = {
    fetchCatalog: false,
    fetchDestinations: false,
    fetchPlanDetails: false,
    checkAvailability: false,
    createOrder: false,
    retrieveOrderStatus: false,
    retrieveEsimCredentials: false,
    retrieveUsage: false,
    topUp: false,
    requestCancelOrRefund: false,
    retrieveBalance: false,
  };
  readonly retry: RetryPolicy = {
    maxAttempts: 1,
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    backoffMultiplier: 2,
  };
  readonly timeoutMs = 5_000;
  readonly apiVersion = "disabled";

  private fail(operation: string): never {
    throw new IntegrationDisabledError(
      "eSIM Access supplier",
      `${operation} is blocked. No credentials, commercial approval, or funded test account exists.`,
    );
  }

  async createOrder(input: CreateSupplierOrderInput): Promise<SupplierOrder> {
    void input;
    return this.fail("createOrder");
  }

  async getOrder(supplierOrderId: string): Promise<SupplierOrder> {
    void supplierOrderId;
    return this.fail("getOrder");
  }

  async getEsims(supplierOrderId: string): Promise<SupplierEsim[]> {
    void supplierOrderId;
    return this.fail("getEsims");
  }

  async healthCheck(): Promise<SupplierHealth> {
    return {
      ok: false,
      message: "Live supplier adapter is disabled pending credentials and approval.",
      checkedAt: new Date(),
    };
  }
}
