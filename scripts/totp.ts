import { loadLocalEnv } from "./env";

async function main(): Promise<void> {
  loadLocalEnv();
  const secret = process.env.DEMO_ADMIN_TOTP_SECRET;
  if (!secret) {
    throw new Error("DEMO_ADMIN_TOTP_SECRET is not set. Run `npm run db:setup` first.");
  }
  const { otpauthUrl, totpCode } = await import("@/lib/auth/totp");
  const email = process.env.DEMO_ADMIN_EMAIL || "admin@demo.local";
  console.log(`Demo admin: ${email}`);
  console.log(`Current TOTP code: ${totpCode(secret)}`);
  console.log(`otpauth URL: ${otpauthUrl(secret, email)}`);
  console.log("DEMO ONLY — this code grants access to the local demo admin.");
}

main().catch((error) => {
  console.error("TOTP helper failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
