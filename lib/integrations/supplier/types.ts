export type IntegrationMode = "sandbox" | "live";

export interface SupplierPlan {
  supplierProductId: string;
  name: string;
  dataMb: number;
  validityDays: number;
  costMinor: number;
  currency: string;
  coverageSummary: string;
  networkSummary: string;
}

export interface CreateSupplierOrderInput {
  transactionId: string;
  productId: string;
  planName: string;
  customerEmail: string;
  quantity: number;
}

export interface SupplierEsim {
  supplierEsimId: string;
  iccid: string;
  lpa: string;
  smdpAddress: string;
  matchingId: string;
  status: string;
  expiresAt?: Date;
}

export interface SupplierOrder {
  supplierOrderId: string;
  status: string;
  esims: SupplierEsim[];
  raw?: Record<string, unknown>;
}

export interface SupplierHealth {
  ok: boolean;
  message: string;
  checkedAt: Date;
}

export interface SupplierAdapter {
  readonly key: string;
  readonly mode: IntegrationMode;
  readonly isMock: boolean;
  createOrder(input: CreateSupplierOrderInput): Promise<SupplierOrder>;
  getOrder(supplierOrderId: string): Promise<SupplierOrder>;
  getEsims(supplierOrderId: string): Promise<SupplierEsim[]>;
  healthCheck(): Promise<SupplierHealth>;
}

export class IntegrationDisabledError extends Error {
  constructor(integration: string, reason: string) {
    super(`${integration} is disabled: ${reason}`);
    this.name = "IntegrationDisabledError";
  }
}
