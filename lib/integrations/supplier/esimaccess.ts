import { createHmac, randomUUID } from "node:crypto";
import { ProviderError } from "@/lib/integrations/supplier/types";

/**
 * eSIM Access catalog client — READ-ONLY.
 *
 * Docs: https://docs.esimaccess.com ("Get All Data Packages").
 *   POST https://api.esimaccess.com/api/v1/open/package/list
 *   Headers: RT-AccessCode, RT-RequestID (uuid), RT-Timestamp (ms),
 *            RT-Signature = lowercase hex HMAC-SHA256(
 *              Timestamp + RequestID + AccessCode + RequestBody, SecretKey)
 *   Prices are integers in 1/10,000 USD (10000 = $1.00); volume is in bytes.
 *
 * This module deliberately implements ONLY the package-list endpoint. It has
 * no order, top-up, cancel, balance, or profile function, so the catalog sync
 * cannot create a financial obligation with the supplier.
 */

export const ESIM_ACCESS_BASE_URL = "https://api.esimaccess.com";
export const ESIM_ACCESS_PACKAGE_LIST_PATH = "/api/v1/open/package/list";
export const ESIM_ACCESS_PROVIDER_KEY = "esimaccess";

export interface EsimAccessOperator {
  operatorName?: string;
  networkType?: string;
}

export interface EsimAccessLocationNetwork {
  locationName?: string;
  locationLogo?: string;
  locationCode?: string;
  operatorList?: EsimAccessOperator[];
}

/** One element of `obj.packageList`, as documented (extra fields tolerated). */
export interface EsimAccessPackage {
  packageCode: string;
  slug: string;
  name: string;
  price: number;
  currencyCode: string;
  volume: number;
  smsStatus?: number;
  dataType?: number;
  unusedValidTime?: number;
  duration: number;
  durationUnit: string;
  location: string;
  locationCode?: string;
  description?: string;
  activeType?: number;
  favorite?: boolean;
  retailPrice?: number;
  speed?: string;
  ipExport?: string;
  supportTopUpType?: number;
  fupPolicy?: string;
  locationNetworkList?: EsimAccessLocationNetwork[];
  [key: string]: unknown;
}

export interface EsimAccessCredentials {
  accessCode: string;
  secretKey: string;
}

export function esimAccessCredentials(env: NodeJS.ProcessEnv = process.env): EsimAccessCredentials | null {
  const accessCode = (env.ESIM_ACCESS_CODE ?? "").trim();
  const secretKey = (env.ESIM_SECRET_KEY ?? "").trim();
  return accessCode && secretKey ? { accessCode, secretKey } : null;
}

export function signEsimAccessRequest(input: {
  timestamp: string;
  requestId: string;
  accessCode: string;
  body: string;
  secretKey: string;
}): string {
  return createHmac("sha256", input.secretKey)
    .update(input.timestamp + input.requestId + input.accessCode + input.body)
    .digest("hex")
    .toLowerCase();
}

interface PackageListResponse {
  success?: unknown;
  errorCode?: unknown;
  errorMsg?: unknown;
  errorMessage?: unknown;
  obj?: { packageList?: unknown } | null;
}

/**
 * Fetch every BASE package (all countries, regional and global) in one
 * request. The documented endpoint has no pagination parameters; the full
 * list is returned at once.
 */
export async function fetchEsimAccessPackages(options: {
  credentials: EsimAccessCredentials;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}): Promise<EsimAccessPackage[]> {
  const body = JSON.stringify({ locationCode: "", type: "BASE", packageCode: "", slug: "", iccid: "" });
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
    response = await (options.fetchImpl ?? fetch)(
      `${options.baseUrl ?? ESIM_ACCESS_BASE_URL}${ESIM_ACCESS_PACKAGE_LIST_PATH}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "RT-AccessCode": options.credentials.accessCode,
          "RT-RequestID": requestId,
          "RT-Timestamp": timestamp,
          "RT-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
        cache: "no-store",
      },
    );
  } catch {
    throw new ProviderError("network", "eSIM Access could not be reached", true);
  }
  if (response.status === 429) {
    throw new ProviderError("rate_limited", "eSIM Access rate limit reached (8 requests/second)", true);
  }
  if (!response.ok) {
    throw new ProviderError("http_error", `eSIM Access returned HTTP ${response.status}`, response.status >= 500);
  }
  let payload: PackageListResponse;
  try {
    payload = (await response.json()) as PackageListResponse;
  } catch {
    throw new ProviderError("invalid_response", "eSIM Access returned invalid JSON", true);
  }
  if (payload.success !== true && payload.success !== "true") {
    const code = typeof payload.errorCode === "string" || typeof payload.errorCode === "number" ? String(payload.errorCode) : "unknown";
    const message = typeof payload.errorMsg === "string" ? payload.errorMsg : typeof payload.errorMessage === "string" ? payload.errorMessage : "";
    // Never echo credentials; the supplier message is a short code description.
    throw new ProviderError(`esimaccess_${code}`, `eSIM Access package list failed (${code}${message ? `: ${message.slice(0, 120)}` : ""})`, code === "900001" || code === "000001");
  }
  const list = payload.obj?.packageList;
  if (!Array.isArray(list)) {
    throw new ProviderError("invalid_response", "eSIM Access response has no packageList", true);
  }
  return list as EsimAccessPackage[];
}
