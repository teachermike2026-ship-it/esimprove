// Supplier-neutral adapter contracts for eSIM integrations.
// No supplier-specific endpoints, authentication formats, or capabilities
// are hardcoded. Every operation requires a verified adapter and capability.

export type AdapterEnvironment = "sandbox" | "production";
export type CapabilityStatus = "unknown" | "documented" | "sandbox_verified" | "production_verified" | "unsupported";

export type AdapterCapability =
  | "catalog_sync"
  | "price_sync"
  | "availability_sync"
  | "order_creation"
  | "order_status"
  | "profile_issuance"
  | "iccid_available"
  | "lpa_format_documented"
  | "qr_payload_documented"
  | "profile_lifecycle_documented"
  | "usage_and_remaining_data"
  | "top_ups"
  | "renewals"
  | "cancellation"
  | "refund_request"
  | "webhooks_documented"
  | "supplier_wallet"
  | "supplier_invoice_access";

export type AdapterConfig = {
  adapterType: string; // generic identifier, not a real supplier name
  baseUrl?: string; // validated, not arbitrary
  environment: AdapterEnvironment;
  authMethod: string; // configured only after documentation; initial preferred: api_key
  timeoutMs?: number;
  syncPreferences?: Record<string, unknown>;
};

export type ConnectionTestResult = {
  success: boolean;
  message: string;
  timestamp: string; // ISO string
  capabilitiesChecked: AdapterCapability[];
};

export interface SupplierAdapter {
  adapterType: string;
  environment: AdapterEnvironment;
  // Only implemented when supplier contract and sandbox verification exist.
  testConnection?(config: AdapterConfig, credentialReference: string): Promise<ConnectionTestResult>;
  getCapabilities?(): AdapterCapability[];
  fetchCatalog?(): Promise<unknown[]>;
  fetchPrices?(): Promise<unknown[]>;
  fetchAvailability?(): Promise<unknown[]>;
  createOrder?(orderData: unknown): Promise<unknown>;
  getOrderStatus?(orderReference: string): Promise<unknown>;
  getProfileDetails?(profileReference: string): Promise<unknown>;
  getUsage?(profileReference: string): Promise<unknown>;
  cancelOrder?(orderReference: string): Promise<unknown>;
  requestRefund?(refundData: unknown): Promise<unknown>;
}

export type CapabilityVerificationRecord = {
  capability: AdapterCapability;
  status: CapabilityStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
};
