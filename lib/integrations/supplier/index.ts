import { flags } from "@/lib/config";
import { MockSupplierAdapter } from "@/lib/integrations/supplier/mock";
import { DisabledLiveSupplierAdapter } from "@/lib/integrations/supplier/disabled";
import type { SupplierAdapter } from "@/lib/integrations/supplier/types";

let adapter: SupplierAdapter | undefined;

export function getSupplierAdapter(): SupplierAdapter {
  if (!adapter) {
    if (flags.supplierLive) {
      adapter = new DisabledLiveSupplierAdapter();
    } else {
      adapter = new MockSupplierAdapter({
        failFirstAttempt: process.env.MOCK_SUPPLIER_FAIL_ONCE === "true",
      });
    }
  }
  return adapter;
}
