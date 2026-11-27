import { flags, mockCommerceAllowed } from "@/lib/config";
import { MockSupplierAdapter } from "@/lib/integrations/supplier/mock";
import { DisabledLiveSupplierAdapter } from "@/lib/integrations/supplier/disabled";
import {
  ProviderError,
  type SupplierAdapter,
} from "@/lib/integrations/supplier/types";
import {
  ESIM_ACCESS_PROVIDER_KEY,
  esimAccessCredentials,
} from "@/lib/integrations/supplier/esimaccess";
import { EsimAccessSupplierAdapter } from "@/lib/integrations/supplier/esimaccess-orders";

let adapter: SupplierAdapter | undefined;
let override: ((supplierKey: string) => SupplierAdapter) | null = null;

/** Legacy single adapter for demo/mock plans. */
export function getSupplierAdapter(): SupplierAdapter {
  if (!adapter) {
    if (flags.supplierLive) {
      adapter = new DisabledLiveSupplierAdapter();
    } else if (!mockCommerceAllowed) {
      // Production must never provision a fake eSIM and label it delivered.
      adapter = new DisabledLiveSupplierAdapter();
    } else {
      adapter = new MockSupplierAdapter({
        failFirstAttempt: process.env.MOCK_SUPPLIER_FAIL_ONCE === "true",
      });
    }
  }
  return adapter;
}

/** Test seam: route every supplier key to a fake adapter. Never used in app code. */
export function setSupplierAdapterOverride(factory: ((supplierKey: string) => SupplierAdapter) | null): void {
  override = factory;
}

/**
 * Whether orders for this supplier can actually be placed here. Checkout uses
 * it to refuse payment for plans that cannot be fulfilled.
 */
export function supplierOrderingEnabled(supplierKey: string): boolean {
  if (override) return true;
  if (supplierKey === ESIM_ACCESS_PROVIDER_KEY) return flags.supplierLive && Boolean(esimAccessCredentials());
  return mockCommerceAllowed;
}

/** Raised when a real supplier package cannot be ordered in this environment. */
export class SupplierOrderingDisabledError extends ProviderError {
  constructor(supplierKey: string) {
    super(
      "supplier_not_enabled",
      `Real ${supplierKey} ordering is not enabled (SUPPLIER_LIVE_ENABLED=true and supplier credentials are required). No fake eSIM was issued.`,
      false,
    );
    this.name = "SupplierOrderingDisabledError";
  }
}

/**
 * The supplier that sold this plan fulfils it. A real supplier package is NEVER
 * fulfilled by the mock adapter: without live ordering enabled it fails into
 * manual review instead of producing fake eSIM details.
 */
export function getSupplierAdapterFor(supplierKey: string): SupplierAdapter {
  if (override) return override(supplierKey);
  if (supplierKey === ESIM_ACCESS_PROVIDER_KEY) {
    const credentials = esimAccessCredentials();
    if (!flags.supplierLive || !credentials) throw new SupplierOrderingDisabledError(supplierKey);
    return new EsimAccessSupplierAdapter(credentials);
  }
  return getSupplierAdapter();
}
