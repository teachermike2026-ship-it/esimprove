import { describe, expect, it } from "vitest";
import { MockSupplierAdapter } from "@/lib/integrations/supplier/mock";
import { DisabledLiveSupplierAdapter } from "@/lib/integrations/supplier/disabled";
import {
  DEFAULT_SUPPLIER_CAPABILITIES,
  DEFAULT_RETRY_POLICY,
  type SupplierCapabilities,
} from "@/lib/integrations/supplier/types";

describe("supplier provider adapter", () => {
  it("declares only the capabilities the mock actually supports", () => {
    const adapter = new MockSupplierAdapter();
    expect(adapter.capabilities.createOrder).toBe(true);
    expect(adapter.capabilities.retrieveOrderStatus).toBe(true);
    expect(adapter.capabilities.retrieveEsimCredentials).toBe(true);
    expect(adapter.capabilities.checkAvailability).toBe(true);
    expect(adapter.capabilities.retrieveUsage).toBe(false);
    expect(adapter.capabilities.topUp).toBe(false);
    expect(adapter.capabilities.requestCancelOrRefund).toBe(false);
    expect(adapter.capabilities.retrieveBalance).toBe(false);
    expect(adapter.retry.maxAttempts).toBeGreaterThan(0);
    expect(adapter.timeoutMs).toBeGreaterThan(0);
  });

  it("maps provider failures to retryable and permanent errors", () => {
    const transient = MockSupplierAdapter.toProviderError(new Error("Request timed out"));
    expect(transient.retryable).toBe(true);
    expect(transient.code).toBe("transient_supplier_failure");

    const permanent = MockSupplierAdapter.toProviderError(new Error("Invalid supplier API key"));
    expect(permanent.retryable).toBe(false);
    expect(permanent.code).toBe("provider_error");
  });

  it("reports the disabled live adapter as unavailable", async () => {
    const adapter = new DisabledLiveSupplierAdapter();
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(false);
    expect(adapter.capabilities.createOrder).toBe(false);
    expect(adapter.mode).toBe("live");
  });

  it("exposes default retry and capability values", () => {
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBeGreaterThan(0);
    const capabilities: SupplierCapabilities = DEFAULT_SUPPLIER_CAPABILITIES;
    expect(capabilities.fetchCatalog).toBe(false);
  });
});
