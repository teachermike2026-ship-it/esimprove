import { loadLocalEnv } from "./env";

async function main(): Promise<void> {
  loadLocalEnv();
  const { appEnv, getConfigurationProblems, isDeployed, isNetlify } = await import(
    "@/lib/config"
  );

  if (!isDeployed) {
    console.log(
      `Netlify preflight skipped: APP_ENV=${appEnv} is a local context, not a deployed deploy context.`,
    );
    return;
  }

  console.log(
    `Netlify preflight: APP_ENV=${appEnv}${isNetlify ? " (NETLIFY=true)" : ""}`,
  );

  const problems = getConfigurationProblems();
  if (problems.length > 0) {
    console.error("Deployment configuration is not ready:");
    for (const problem of problems) console.error(`- ${problem}`);
    console.error(
      "Fix the Netlify environment variables for this deploy context. See NETLIFY_ENVIRONMENT_VARIABLES.md.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Deployment configuration checks passed (no database connection attempted).");
  if (!process.env.HEALTH_CHECK_TOKEN) {
    console.log(
      "Warning: HEALTH_CHECK_TOKEN is not set; /api/health will return only public status, not detailed diagnostics.",
    );
  }
}

main().catch((error) => {
  console.error("Netlify preflight failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
