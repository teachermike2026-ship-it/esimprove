import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { plans } from "@/lib/db/schema";
import {
  appEnv,
  demoMode,
  flags,
  integrationModes,
  isProduction,
  seedDemoData,
  siteUrl,
} from "@/lib/config";
import { AlertIcon, CheckIcon, LockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const db = await getDb();
  await db.select({ id: plans.id }).from(plans).limit(1);
  const databaseMode = process.env.DATABASE_URL ? "PostgreSQL (DATABASE_URL)" : "PGlite local";
  const checks = [
    { label: "Database reachable", ok: true },
    { label: "Demo mode enabled", ok: demoMode },
    { label: "Demo seed enabled", ok: seedDemoData },
    { label: "Payments live flag", ok: !flags.paymentsLive },
    { label: "Supplier live flag", ok: !flags.supplierLive },
    { label: "Email live flag", ok: !flags.emailLive },
    { label: "Catalogue sync flag", ok: !flags.catalogueSync },
    { label: "Local demo mode (not a production deploy)", ok: !isProduction },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Settings</h1>
          <p className="muted">
            Safe, non-secret configuration summary. Credentials and encryption keys are never
            rendered here.
          </p>
        </div>
      </div>

      <div className="callout callout-warning section-tight">
        <AlertIcon className="inline-icon" />
        <p>
          This build is not production-ready. Domain, supplier, payment, email, legal, tax, and
          database decisions remain with the owner. Live flags must stay false.
        </p>
      </div>

      <div className="grid grid-2">
        <section className="card form">
          <h2>Environment</h2>
          <dl className="meta-list">
            <div>
              <dt>APP_ENV</dt>
              <dd>{appEnv}</dd>
            </div>
            <div>
              <dt>SITE_URL</dt>
              <dd>{siteUrl}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{databaseMode}</dd>
            </div>
            <div>
              <dt>Supplier mode</dt>
              <dd>{integrationModes.supplier}</dd>
            </div>
            <div>
              <dt>Payments mode</dt>
              <dd>{integrationModes.payments}</dd>
            </div>
            <div>
              <dt>Email mode</dt>
              <dd>{integrationModes.email}</dd>
            </div>
            <div>
              <dt>Admin 2FA required</dt>
              <dd>{flags.admin2faRequired ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </section>

        <section className="card form">
          <h2>Safety checks</h2>
          <ul className="check-list">
            {checks.map((check) => (
              <li key={check.label}>
                {check.ok ? (
                  <CheckIcon className="inline-icon" />
                ) : (
                  <LockIcon className="inline-icon" />
                )}
                <span>
                  {check.label}: <strong>{check.ok ? "safe for demo" : "needs review"}</strong>
                </span>
              </li>
            ))}
          </ul>
          <p className="form-note">
            The production gate also requires a verified domain, managed PostgreSQL,
            approved payment and supplier credentials, a verified email domain, and legal
            review. None are configured.
          </p>
        </section>
      </div>

      <section className="card form section-tight">
        <h2>What is not connected</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Integration</th>
                <th scope="col">Current adapter</th>
                <th scope="col">Live status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>eSIM supplier</td>
                <td>Deterministic mock</td>
                <td>Disabled — no credentials or approval</td>
              </tr>
              <tr>
                <td>Payments</td>
                <td>Signed mock webhook</td>
                <td>Disabled — no processor approval</td>
              </tr>
              <tr>
                <td>Email</td>
                <td>Local logger</td>
                <td>Disabled — no verified sending domain</td>
              </tr>
              <tr>
                <td>Catalogue sync</td>
                <td>Local demo seed</td>
                <td>Disabled — no supplier feed</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
