/**
 * Netlify Scheduled Function: runs the ESIMPROVE background worker every
 * 15 minutes so crypto payments are detected and confirmed even after the
 * customer closes the payment page.
 *
 * Why not every minute: each run queries the database, and a run every minute
 * keeps a scale-to-zero database (Neon, Netlify Database) awake 24/7, which
 * exhausted the Neon free compute quota and took the site's database offline.
 * While a customer has the crypto payment page open, the page itself asks the
 * server to verify the payment every few seconds (/api/orders/[id]/verify), so
 * detection there stays immediate; this job is the backstop for closed pages,
 * late transfers and fulfillment retries.
 *
 * It only calls this site's own protected endpoint, POST /api/jobs/run, which
 * runs the crypto monitor (NodeReal BSC scan + RPC verification) and the
 * fulfillment outbox. It never contacts Whop and never moves funds.
 *
 * Required Netlify environment variables (already used by the app):
 *   INTERNAL_JOB_SECRET  - shared secret checked by /api/jobs/run
 * Netlify provides URL (the site's primary URL) automatically.
 *
 * Scheduled functions run only on published production deploys.
 */

export default async function cryptoPaymentMonitor(): Promise<Response> {
  const siteUrl = process.env.URL ?? process.env.APP_URL;
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!siteUrl || !secret) {
    console.error("crypto-payment-monitor: URL/APP_URL or INTERNAL_JOB_SECRET is missing");
    return new Response("not configured", { status: 500 });
  }

  try {
    const response = await fetch(new URL("/api/jobs/run", siteUrl), {
      method: "POST",
      headers: { "x-internal-job-secret": secret },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      console.error(`crypto-payment-monitor: /api/jobs/run returned HTTP ${response.status}`);
    }
    return new Response(null, { status: response.ok ? 204 : 502 });
  } catch {
    console.error("crypto-payment-monitor: /api/jobs/run could not be reached");
    return new Response(null, { status: 502 });
  }
}

export const config = {
  schedule: "*/15 * * * *",
};
