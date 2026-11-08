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

export interface SupplierCatalogEntry {
  supplierProductId: string;
  planName: string;
  dataMb: number;
  validityDays: number;
  costMinor: number;
  currency: string;
  coverageSummary: string;
  networkSummary: string;
  destinationSlug?: string;
  effectiveAt?: Date;
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

/**
 * Capabilities are declared explicitly so the purchasing pipeline never calls a
 * vendor operation that the provider has not actually implemented. Missing
 * capabilities are represented as unsupported rather than silently assumed.
 */
export interface SupplierCapabilities {
  fetchCatalog?: boolean;
  fetchDestinations?: boolean;
  fetchPlanDetails?: boolean;
  checkAvailability?: boolean;
  createOrder?: boolean;
  retrieveOrderStatus?: boolean;
  retrieveEsimCredentials?: boolean;
  retrieveUsage?: boolean;
  topUp?: boolean;
  requestCancelOrRefund?: boolean;
  retrieveBalance?: boolean;
}

export const DEFAULT_SUPPLIER_CAPABILITIES: SupplierCapabilities = {
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

export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
};

export interface ProviderClientConfig {
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  timeoutMs: number;
  retry: RetryPolicy;
}

export interface SupplierAdapter {
  readonly key: string;
  readonly mode: IntegrationMode;
  readonly isMock: boolean;
  readonly capabilities: SupplierCapabilities;
  readonly retry: RetryPolicy;
  readonly timeoutMs: number;
  readonly apiVersion: string;
  createOrder(input: CreateSupplierOrderInput): Promise<SupplierOrder>;
  getOrder(supplierOrderId: string): Promise<SupplierOrder>;
  getEsims(supplierOrderId: string): Promise<SupplierEsim[]>;
  healthCheck(): Promise<SupplierHealth>;
  fetchCatalog?(): Promise<SupplierCatalogEntry[]>;
}

export class IntegrationDisabledError extends Error {
  constructor(integration: string, reason: string) {
    super(`${integration} is disabled: ${reason}`);
    this.name = "IntegrationDisabledError";
  }
}
