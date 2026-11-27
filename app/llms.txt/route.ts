import { getDb } from "@/lib/db/client";
import { siteUrl } from "@/lib/config";
import { buildLlmsTxt } from "@/lib/llms-txt";
import { loadSeoSettings } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const db = await getDb();
  const settings = await loadSeoSettings(db);
  const base = (settings.canonicalBase || siteUrl).replace(/\/+$/, "");
  const body = await buildLlmsTxt(db, base);
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "x-robots-tag": "noindex",
    },
  });
}
