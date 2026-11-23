import { loadLocalEnv } from "./env";

/**
 * Read-only Whop catalogue discovery.
 *
 * This script NEVER creates a checkout, payment, product, plan, webhook, or
 * charge. It only reads the account, permissions, products and variants
 * visible to the configured Whop API key and prints non-secret catalogue
 * fields so the operator can build WHOP_PLAN_VARIANT_MAP.
 *
 * Usage:
 *   npx tsx scripts/whop-discover.ts
 *
 * Required environment:
 *   WHOP_COMPANY_API_KEY   Whop account API key (server-side only)
 *   WHOP_SANDBOX           "true" for sandbox, "false" for production
 *   WHOP_ACCOUNT_ID        biz_... account to inspect. Supplying it avoids the
 *                          accounts.me/list/search calls, which need broader
 *                          account-read scopes that checkout does not require.
 *
 * The API key is never printed. Treat the printed product/variant IDs as
 * configuration, not secrets.
 */

function trimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function money(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

function recordString(
  value: Record<string, unknown> | null,
  key: string,
): string | null {
  const field = value?.[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

/**
 * Extracts only a short provider message from an error body. Headers, request
 * details, and the API key are never read or printed.
 */
function safeProviderMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const body = "body" in error ? (error as { body?: unknown }).body : null;
  if (typeof body === "string" && body.trim()) {
    return body.trim().slice(0, 300);
  }
  if (body && typeof body === "object") {
    const nestedError = (body as Record<string, unknown>).error;
    if (nestedError && typeof nestedError === "object") {
      const nestedMessage = (nestedError as Record<string, unknown>).message;
      if (typeof nestedMessage === "string" && nestedMessage.trim()) {
        return nestedMessage.trim().slice(0, 300);
      }
    }
    for (const key of ["message", "error", "detail"]) {
      const value = (body as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim().slice(0, 300);
      }
    }
  }
  // Do not fall back to error.message: some SDK errors include the raw body
  // and request context. Returning null keeps the output limited to the
  // safe status line.
  return null;
}

// Actions the existing integration actually uses:
// - checkout_configuration:create creates the hosted checkout.
// - access_pass:basic:read lists products/variants for catalogue mapping.
// - plan:basic:read reads the variant attached to a checkout.
// company:balance:read is deliberately excluded: it is only needed to resolve
// an account automatically, and WHOP_ACCOUNT_ID is now required. The webhook
// path uses the signing secret, not a Whop API permission.
const REQUIRED_PERMISSIONS = [
  "checkout_configuration:create",
  "access_pass:basic:read",
  "plan:basic:read",
];

async function main(): Promise<void> {
  loadLocalEnv();

  const apiKey = trimmedEnv("WHOP_COMPANY_API_KEY");
  if (!apiKey) {
    console.error(
      "WHOP_COMPANY_API_KEY is not set. Add it to .env.local (never commit it) and rerun.",
    );
    process.exitCode = 1;
    return;
  }

  const sandboxSetting = trimmedEnv("WHOP_SANDBOX")?.toLowerCase();
  if (sandboxSetting !== "true" && sandboxSetting !== "false") {
    console.error("Set WHOP_SANDBOX to exactly true or false before running discovery.");
    process.exitCode = 1;
    return;
  }
  const sandbox = sandboxSetting === "true";

  const { WhopClient, WhopEnvironment } = await import("@whop/sdk");

  const client = new WhopClient({
    token: apiKey,
    environment: sandbox ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
    logging: { level: "error" },
    maxRetries: 1,
    timeoutInSeconds: 20,
  });

  console.log(`Whop catalogue discovery (${sandbox ? "sandbox" : "live"})`);
  console.log("Read-only: no checkout, payment, or catalogue change is created.\n");

  const accountId = trimmedEnv("WHOP_ACCOUNT_ID");
  if (!accountId) {
    console.error(
      "WHOP_ACCOUNT_ID is required. Copy the biz_... account ID from the Whop dashboard for the ESIMPROVE business, add it to .env.local, and rerun.",
    );
    process.exitCode = 1;
    return;
  }
  if (!accountId.startsWith("biz_")) {
    console.error(
      "WHOP_ACCOUNT_ID must be the biz_... account ID shown in the Whop dashboard for the ESIMPROVE business.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Account: ${accountId}\n`);

  console.log("Checking permissions...");
  try {
    const permissionResult = await client.permissions.list({
      resource_id: accountId,
      actions: REQUIRED_PERMISSIONS.join(","),
    });
    console.log("Permission check:");
    for (const grant of permissionResult.data) {
      console.log(`  ${grant.granted ? "granted" : "MISSING"}  ${grant.action}`);
    }
    console.log(
      "  Note: company:balance:read is not required; the account is supplied explicitly.",
    );
  } catch (error) {
    console.log(
      `Permission check unavailable${
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        typeof (error as { statusCode: unknown }).statusCode === "number"
          ? ` (HTTP ${(error as { statusCode: number }).statusCode})`
          : ""
      }. Continuing with read-only catalogue discovery.`,
    );
  }
  console.log("");

  console.log("Listing products...");
  const products: Array<{
    id: string;
    title: string;
    route: string;
    external_identifier: string | null;
    headline: string | null;
    visibility: string | null;
    variant_attributes: Record<string, unknown> | null;
  }> = [];
  let productPage = await client.products.list({
    account_id: accountId,
    first: 100,
  });
  products.push(...productPage.data);
  while (productPage.hasNextPage()) {
    productPage = await productPage.getNextPage();
    products.push(...productPage.data);
  }

  const productTitleById = new Map(products.map((product) => [product.id, product.title]));

  console.log(`Products (${products.length}):`);
  for (const product of products) {
    console.log(`Product ${product.id}  ${product.title}`);
    console.log(`  route: ${product.route}`);
    if (product.external_identifier) {
      console.log(`  external_identifier: ${product.external_identifier}`);
    }
    if (product.headline) console.log(`  headline: ${product.headline}`);
    if (product.visibility) console.log(`  visibility: ${product.visibility}`);
    if (product.variant_attributes) {
      console.log(`  variant_attributes: ${JSON.stringify(product.variant_attributes)}`);
    }
  }
  console.log("");

  console.log("Listing variants...");
  const variants: Array<{
    id: string;
    title: string | null;
    product: Record<string, unknown> | null;
    currency: string;
    initial_price: number;
    billing_type: string;
    expiration_days: number | null;
    visibility: string;
    attributes: Record<string, string | null> | null;
  }> = [];
  let variantPage = await client.variants.list({
    account_id: accountId,
    first: 100,
  });
  variants.push(...variantPage.data);
  while (variantPage.hasNextPage()) {
    variantPage = await variantPage.getNextPage();
    variants.push(...variantPage.data);
  }

  console.log(`Variants (${variants.length}):`);
  for (const variant of variants) {
    const productId = recordString(variant.product, "id");
    const productTitle = productId ? productTitleById.get(productId) : null;
    const title = variant.title ?? "(untitled variant)";
    const productLabel = productId
      ? `${productId}${productTitle ? ` ${productTitle}` : ""}`
      : "(no product)";
    console.log(
      `  ${variant.id}  ${title}  ${money(variant.initial_price, variant.currency)}  ${variant.billing_type}  expires=${variant.expiration_days ?? "never"}  ${variant.visibility}`,
    );
    console.log(`    product: ${productLabel}`);
    if (variant.attributes) {
      console.log(`    attributes: ${JSON.stringify(variant.attributes)}`);
    }
  }

  console.log("");
  console.log(`Discovered ${products.length} product(s) and ${variants.length} variant(s).`);
  if (products.length === 0 && variants.length === 0) {
    console.log(
      "No products or variants exist on this account. Do not create WHOP_PLAN_VARIANT_MAP entries; the Whop catalogue must exist before checkout can be enabled.",
    );
  } else {
    console.log(
      "Use the plan_... variant IDs above to build WHOP_PLAN_VARIANT_MAP. Only map a variant when its product identity, one-time billing, currency, and price match the ESIMPROVE plan exactly.",
    );
  }
}

main().catch((error: unknown) => {
  // Never print the API key, request headers, or raw provider payload.
  // Only a safe status/summary is emitted.
  const detail = safeProviderMessage(error);
  const suffix = detail ? ` Provider message: ${detail}` : "";
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    console.error(
      `Whop discovery failed with HTTP status ${(error as { statusCode: number }).statusCode}. ` +
        `Confirm the key type, sandbox setting, and catalogue read permissions.${suffix}`,
    );
  } else {
    console.error(
      `Whop discovery failed. Confirm network access, the key type, the sandbox setting, and catalogue read permissions.${suffix}`,
    );
  }
  process.exitCode = 1;
});
