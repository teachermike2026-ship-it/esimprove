/**
 * IndexNow key file (https://www.indexnow.org). Bing, Yandex, Seznam and
 * Naver use IndexNow to learn about new or changed URLs quickly. The key is
 * public by design; it only proves that submissions come from this site.
 * Submissions are sent by scripts/indexnow-submit.ts, never from localhost.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
