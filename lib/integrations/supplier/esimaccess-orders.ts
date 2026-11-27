import { randomUUID } from "node:crypto";
import {
  DEFAULT_RETRY_POLICY,
  ProviderError,
  type CreateSupplierOrderInput,
  type RetryPolicy,
  type SupplierAdapter,
  type SupplierCapabilities,
  type SupplierEsim,
  type SupplierHealth,
  type SupplierOrder,
} from "@/lib/integrations/supplier/types";
import {
  ESIM_ACCESS_BASE_URL,
  ESIM_ACCESS_PROVIDER_KEY,
  signEsimAccessRequest,
  type EsimAccessCredentials,
} from "@/lib/integrations/supplier/esimaccess";

/**
 * eSIM Access ORDERING adapter (https://docs.esimaccess.com).
 *
 *   POST /api/v1/open/esim/order  -> { orderNo }  (profiles allocate asynchronously)
 *   POST /api/v1/open/esim/query  -> { esimList[] } by orderNo; error 200010
 *                                    while the SM-DP+ is still allocating.
 *
 * transactionId is the idempotency key: the supplier treats a repeated
 * transactionId as the same order, so a retried request never buys twice.
 *
 * This adapter creates REAL supplier purchases. getSupplierAdapterFor() only
 * builds it when SUPPLIER_LIVE_ENABLED=true and credentials are configured.
 */

export const ESIM_ACCESS_ORDER_PATH = "/api/v1/open/esim/order";
export const ESIM_ACCESS_QUERY_PATH = "/api/v1/open/esim/query";

interface ApiEnvelope {
  success?: unknown;
  errorCode?: unknown;
  errorMsg?: unknown;
  errorMessage?: unknown;
  obj?: unknown;
}

/** Map a documented eSIM Access error code to a safe, classified error. */
export function esimAccessError(code: string, message: string): ProviderError {
  const detail = message ? `${code}: ${message.slice(0, 120)}` : code;
  switch (code) {
    case "200010":
      return new ProviderError("allocating", "eSIM Access is still allocating the profiles", true);
    case "200007":
      return new ProviderError("insufficient_balance", `eSIM Access balance is insufficient (${detail})`, false);
    case "200005":
    case "200006":
      return new ProviderError("price_mismatch", `eSIM Access price check failed (${detail})`, false);
    case "200011":
      return new ProviderError("out_of_stock", `eSIM Access has no profiles available (${detail})`, false);
    case "310241":
    case "310243":
      return new ProviderError("package_unavailable", `eSIM Access package is unavailable (${detail})`, false);
    case "900001":
    case "000001":
    case "101001":
      return new ProviderError("supplier_busy", `eSIM Access temporary error (${detail})`, true);
    default:
      return new ProviderError("supplier_error", `eSIM Access request failed (${detail})`, false);
  }
}

export async function esimAccessRequest<T>(
  path: string,
  payload: Record<string, unknown>,
  options: { credentials: EsimAccessCredentials; fetchImpl?: typeof fetch; timeoutMs?: number; baseUrl?: string },
): Promise<T> {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const requestId = randomUUID().replace(/-/g, "");
  const signature = signEsimAccessRequest({
    timestamp,
    requestId,
    accessCode: options.credentials.accessCode,
    body,
    secretKey: options.credentials.secretKey,
  });
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(`${options.baseUrl ?? ESIM_ACCESS_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "RT-AccessCode": options.credentials.accessCode,
        "RT-RequestID": requestId,
        "RT-Timestamp": timestamp,
        "RT-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      cache: "no-store",
    });
  } catch {
    // Unknown outcome: the order may or may not exist. Retrying with the same
    // transactionId is safe because the supplier deduplicates it.
    throw new ProviderError("network", "eSIM Access could not be reached", true);
  }
  if (response.status === 429) throw new ProviderError("rate_limited", "eSIM Access rate limit reached", true);
  if (!response.ok) {
    throw new ProviderError("http_error", `eSIM Access returned HTTP ${response.status}`, response.status >= 500);
  }
  let envelope: ApiEnvelope;
  try {
    envelope = (await response.json()) as ApiEnvelope;
  } catch {
    throw new ProviderError("invalid_response", "eSIM Access returned invalid JSON", true);
  }
  if (envelope.success !== true && envelope.success !== "true") {
    const code =
      typeof envelope.errorCode === "string" || typeof envelope.errorCode === "number"
        ? String(envelope.errorCode)
        : "unknown";
    const message =
      typeof envelope.errorMsg === "string"
        ? envelope.errorMsg
        : typeof envelope.errorMessage === "string"
          ? envelope.errorMessage
          : "";
    throw esimAccessError(code, message);
  }
  return envelope.obj as T;
}

interface QueryEsim {
  esimTranNo?: unknown;
  orderNo?: unknown;
  iccid?: unknown;
  ac?: unknown;
  smdpStatus?: unknown;
  esimStatus?: unknown;
  expiredTime?: unknown;
  packageList?: Array<{ packageCode?: unknown }>;
}

function parseQueryEsim(row: QueryEsim): SupplierEsim | null {
  const id = typeof row.esimTranNo === "string" ? row.esimTranNo : null;
  const ac = typeof row.ac === "string" ? row.ac.trim() : "";
  const iccid = typeof row.iccid === "string" ? row.iccid.trim() : "";
  // Documented activation code format: LPA:1${SM-DP+ address}${matching id}
  const match = /^LPA:1\$([^$]+)\$([^$]+)$/.exec(ac);
  if (!id || !match || !/^\d{18,22}$/.test(iccid)) return null;
  const expires = typeof row.expiredTime === "string" ? new Date(row.expiredTime.replace(/\+0000$/, "Z")) : null;
  return {
    supplierEsimId: id,
    iccid,
    lpa: ac,
    smdpAddress: match[1]!,
    matchingId: match[2]!,
    status: typeof row.esimStatus === "string" ? row.esimStatus : "GOT_RESOURCE",
    expiresAt: expires && !Number.isNaN(expires.getTime()) ? expires : undefined,
  };
}

export interface EsimAccessOrderInput extends CreateSupplierOrderInput {
  /** Supplier unit price in 1/10,000 USD, sent as a price check. */
  unitPriceRaw?: number;
  /** Days for day-pass (dataType 2) packages. */
  periodNum?: number;
}

export class EsimAccessSupplierAdapter implements SupplierAdapter {
  readonly key = ESIM_ACCESS_PROVIDER_KEY;
  readonly mode = "live" as const;
  readonly isMock = false;
  readonly capabilities: SupplierCapabilities = {
    fetchCatalog: true,
    createOrder: true,
    retrieveOrderStatus: true,
    retrieveEsimCredentials: true,
  };
  readonly retry: RetryPolicy = DEFAULT_RETRY_POLICY;
  readonly timeoutMs = 30_000;
  readonly apiVersion = "v1";

  constructor(
    private readonly credentials: EsimAccessCredentials,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  async createOrder(input: EsimAccessOrderInput): Promise<SupplierOrder> {
    if (!input.transactionId || input.transactionId.length > 50) {
      throw new ProviderError("invalid_request", "transactionId must be 1-50 characters", false);
    }
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 30) {
      throw new ProviderError("invalid_request", "eSIM Access orders allow 1-30 profiles per request", false);
    }
    const packageInfo: Record<string, unknown> = { packageCode: input.productId, count: input.quantity };
    if (input.unitPriceRaw !== undefined) packageInfo.price = input.unitPriceRaw;
    if (input.periodNum !== undefined) packageInfo.periodNum = input.periodNum;
    const payload: Record<string, unknown> = { transactionId: input.transactionId, packageInfoList: [packageInfo] };
    if (input.unitPriceRaw !== undefined) payload.amount = input.unitPriceRaw * input.quantity;

    const obj = await esimAccessRequest<{ orderNo?: unknown }>(ESIM_ACCESS_ORDER_PATH, payload, {
      credentials: this.credentials,
      fetchImpl: this.fetchImpl,
    });
    const orderNo = typeof obj?.orderNo === "string" ? obj.orderNo : null;
    if (!orderNo) throw new ProviderError("invalid_response", "eSIM Access order has no orderNo", true);
    // Profiles are allocated asynchronously; fetch them with getEsims().
    return { supplierOrderId: orderNo, status: "ordered", esims: [], raw: { orderNo } };
  }

  async getEsims(supplierOrderId: string): Promise<SupplierEsim[]> {
    const obj = await esimAccessRequest<{ esimList?: QueryEsim[] }>(
      ESIM_ACCESS_QUERY_PATH,
      { orderNo: supplierOrderId, iccid: "", pager: { pageNum: 1, pageSize: 50 } },
      { credentials: this.credentials, fetchImpl: this.fetchImpl },
    );
    const list = Array.isArray(obj?.esimList) ? obj.esimList : [];
    if (list.length === 0) throw new ProviderError("allocating", "No profiles returned yet", true);
    const parsed = list.map(parseQueryEsim);
    if (parsed.some((esim) => esim === null)) {
      throw new ProviderError("invalid_response", "eSIM Access returned an incomplete profile", false);
    }
    return parsed as SupplierEsim[];
  }

  async getOrder(supplierOrderId: string): Promise<SupplierOrder> {
    const esims = await this.getEsims(supplierOrderId);
    return { supplierOrderId, status: "allocated", esims };
  }

  async healthCheck(): Promise<SupplierHealth> {
    // No network call: a balance or order request is never made for a health check.
    return { ok: true, message: "eSIM Access ordering is configured", checkedAt: new Date() };
  }
}
