/**
 * Submit the site's public URLs to IndexNow (Bing, Yandex, Seznam, Naver).
 *
 *   npx tsx scripts/indexnow-submit.ts            # dry run: prints counts only
 *   npx tsx scripts/indexnow-submit.ts --send     # submits (deployed site only)
 *
 * Refuses to run for localhost or a noindex deployment: submitting URLs that
 * search engines cannot fetch wastes the site's crawl reputation.
 */
import { loadLocalEnv } from "./env";

async function main(): Promise<void> {
  loadLocalEnv();
  const send = process.argv.includes("--send");
  const { siteUrl, noIndex } = await import("@/lib/config");
  const { getDb } = await import("@/lib/db/client");
  const { buildSitemap } = await import("@/lib/sitemap");
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) throw new Error("INDEXNOW_KEY is not set");
  const host = new URL(siteUrl).hostname;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) || host.endsWith(".localhost")) {
    throw new Error(`Refusing to submit ${host}: IndexNow is only for the deployed public site`);
  }
  if (noIndex) throw new Error("Refusing to submit a noindex deployment");

  const urls = (await buildSitemap(await getDb())).map((entry) => entry.url).filter((url) => new URL(url).hostname === host);
  console.log(`host ${host}: ${urls.length} URLs`);
  if (!send) {
    console.log("Dry run. Add --send to submit.");
    return;
  }
  for (let i = 0; i < urls.length; i += 10_000) {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${siteUrl.replace(/\/+$/, "")}/indexnow-key.txt`,
        urlList: urls.slice(i, i + 10_000),
      }),
    });
    console.log(`batch ${i / 10_000 + 1}: HTTP ${response.status}`);
  }
}

main().catch((error) => {
  console.error("IndexNow submit failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
