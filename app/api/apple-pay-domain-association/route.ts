/**
 * Apple Pay domain verification for Whop's embedded checkout.
 *
 * Apple fetches /.well-known/apple-developer-merchantid-domain-association
 * (rewritten here by next.config.ts) when Whop registers esimprove.com for
 * Apple Pay. Paste the file content Whop provides into the
 * APPLE_PAY_DOMAIN_ASSOCIATION environment variable; until then this returns
 * 404 and Apple Pay simply does not appear (cards still work).
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  const content = process.env.APPLE_PAY_DOMAIN_ASSOCIATION?.trim();
  if (!content) return new Response("Not found", { status: 404 });
  return new Response(content.replace(/\n/g, "\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
