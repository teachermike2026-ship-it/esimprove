/**
 * OWNER-RUN ONLY. Creates the ESIMPROVE Whop webhook, pinned to the payload
 * version the code was verified against.
 *
 *   npm run whop:webhook                      -> dry run: prints the plan, no network
 *   npm run whop:webhook -- --create --confirm -> creates the webhook in YOUR Whop account
 *   npm run whop:webhook -- --url=https://<tunnel> --sandbox-only --create --confirm
 *       -> sandbox testing: registers a tunnel URL and refuses unless WHOP_SANDBOX=true
 *
 * What it does with --create --confirm (one authenticated API call):
 *   POST /api/v1/webhooks  { url, api_version_date, events, enabled, title }
 * It creates no checkout, product, payment, or test event, and sends no
 * webhook. The returned signing secret is never printed; it is written to
 * `.env.whop-webhook.local` (git-ignored) for you to copy into
 * WHOP_WEBHOOK_SECRET on Netlify, after which you should delete that file.
 *
 * Do not run this until your Whop account is approved and you intend to
 * activate card payments.
 */
import { writeFileSync } from "node:fs";
import { loadLocalEnv } from "./env";
import {
  WHOP_HANDLED_EVENT_TYPES,
  WHOP_WEBHOOK_API_VERSION_DATE,
} from "../lib/integrations/payment/whop-webhook";

loadLocalEnv();

const argv = process.argv.slice(2);
const args = new Set(argv);
const urlArg = argv.find((arg) => arg.startsWith("--url="))?.slice("--url=".length);
const appUrl = (urlArg ?? process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
const sandboxOnly = args.has("--sandbox-only");
const webhookUrl = `${appUrl}/api/webhooks/whop`;
const plan = {
  url: webhookUrl,
  api_version_date: WHOP_WEBHOOK_API_VERSION_DATE,
  events: [...WHOP_HANDLED_EVENT_TYPES],
  enabled: true,
  title: "ESIMPROVE payments",
};

async function main() {
  if (!/^https:\/\/[^/]+$/.test(appUrl) || /localhost|127\.0\.0\.1/.test(appUrl)) {
    console.error("APP_URL must be your public HTTPS site (for example https://esimprove.com).");
    process.exit(1);
  }

  console.log("Whop webhook plan:");
  console.log(JSON.stringify(plan, null, 2));

  if (!args.has("--create") || !args.has("--confirm")) {
    console.log("\nDry run only. Nothing was sent to Whop.");
    console.log("To create it in your account: npm run whop:webhook -- --create --confirm");
    return;
  }

  const { whopCredentials } = await import("../lib/config");
  const apiKey = whopCredentials().apiKey;
  if (!apiKey) {
    console.error("WHOP_API_KEY is not set.");
    process.exit(1);
  }

  const { WhopClient, WhopEnvironment } = await import("@whop/sdk");
  const sandbox = (process.env.WHOP_SANDBOX ?? "").trim().toLowerCase() === "true";
  if (sandboxOnly && !sandbox) {
    console.error("--sandbox-only was given but WHOP_SANDBOX is not true. Nothing was sent to Whop.");
    process.exit(1);
  }
  const client = new WhopClient({
    token: apiKey,
    environment: sandbox ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
    maxRetries: 0,
  });
  const accountId = whopCredentials().companyId;
  const webhook = await client.webhooks.create({
    ...plan,
    ...(accountId ? { resource_id: accountId } : {}),
  } as Parameters<typeof client.webhooks.create>[0]);

  console.log(`\nCreated webhook ${webhook.id} (api_version ${webhook.api_version}, pinned ${webhook.api_version_date ?? "unpinned"}).`);
  if (webhook.api_version_date !== WHOP_WEBHOOK_API_VERSION_DATE) {
    console.warn("Warning: the pin differs from what ESIMPROVE expects. Check docs/WHOP-WEBHOOKS.md.");
  }
  if (webhook.webhook_secret) {
    writeFileSync(".env.whop-webhook.local", `WHOP_WEBHOOK_SECRET=${webhook.webhook_secret}\n`, {
      mode: 0o600,
    });
    console.log("Signing secret saved to .env.whop-webhook.local (not printed, git-ignored).");
    console.log("Copy it into WHOP_WEBHOOK_SECRET on Netlify, then delete that file.");
  } else {
    console.log("No signing secret was returned; copy it from the Whop dashboard.");
  }
}

main().catch((error: unknown) => {
  console.error("Webhook setup failed:", error instanceof Error ? error.name : "unknown error");
  process.exit(1);
});
