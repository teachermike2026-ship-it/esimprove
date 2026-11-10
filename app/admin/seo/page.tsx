import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { loadSeoSettings, auditSeoHealth } from "@/lib/seo";
import { SeoSettingsForm } from "./seo-form";

export const metadata: Metadata = {
  title: "SEO settings",
  robots: { index: false, follow: false },
};

export default async function AdminSeoPage() {
  await requireStaff("/admin/seo", "seo");
  const db = await getDb();
  const [settings, health] = await Promise.all([
    loadSeoSettings(db),
    auditSeoHealth(db),
  ]);

  const statusCards = [
    { label: "Published articles", value: health.publishedCount },
    { label: "Drafts", value: health.draftCount },
    { label: "Scheduled", value: health.scheduledCount },
    { label: "Missing titles", value: health.missingTitle, warn: health.missingTitle > 0 },
    { label: "Missing descriptions", value: health.missingDescription, warn: health.missingDescription > 0 },
    { label: "Duplicate titles", value: health.duplicateTitles, warn: health.duplicateTitles > 0 },
    { label: "Duplicate descriptions", value: health.duplicateDescriptions, warn: health.duplicateDescriptions > 0 },
    { label: "Missing image alt", value: health.missingAlt, warn: health.missingAlt > 0 },
    { label: "Missing featured image", value: health.missingFeaturedImage, warn: health.missingFeaturedImage > 0 },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Content</p>
          <h1>SEO and CMS</h1>
          <p className="muted">Professional SEO settings, health checks, and content controls.</p>
        </div>
        <div className="row gap-8">
          <Link href="/admin/blog" className="btn btn-secondary">Blog CMS</Link>
          <Link href="/sitemap.xml" className="link-button" target="_blank">Sitemap</Link>
        </div>
      </div>

      <section className="card section-tight">
        <div className="stat-head">
          <h2>SEO health</h2>
          <span className="muted small">Checked {health.lastCheckedAt.toLocaleString()}</span>
        </div>
        <div className="stat-grid">
          {statusCards.map((card) => (
            <article className={`card stat ${card.warn ? "stat-warn" : ""}`} key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
        {health.warnings.length > 0 ? (
          <div className="section-tight">
            {health.warnings.map((warning) => (
              <div key={warning.type} className="alert alert-warn">
                <strong>{warning.type}:</strong> {warning.count}. {warning.hint}
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-ok">No SEO defects detected in published articles.</div>
        )}
      </section>

      <SeoSettingsForm settings={settings} />

      <section className="card form section-tight">
        <h2>Technical SEO status</h2>
        <dl className="meta-list">
          <div>
            <dt>Sitemap</dt>
            <dd><Link href="/sitemap.xml" className="link">/sitemap.xml</Link> — dynamic, published content only</dd>
          </div>
          <div>
            <dt>Robots</dt>
            <dd><Link href="/robots.txt" className="link">/robots.txt</Link> — excludes admin, portal, checkout, API</dd>
          </div>
          <div>
            <dt>Google Search Console verification</dt>
            <dd>{settings.gscVerificationToken ? "Configured (meta token stored)" : "Not configured"}</dd>
          </div>
          <div>
            <dt>Structured data</dt>
            <dd>WebSite, WebPage, Organization, Article, BreadcrumbList</dd>
          </div>
          <div>
            <dt>GA4</dt>
            <dd>{settings.ga4MeasurementId ? `Configured (${settings.ga4MeasurementId.slice(0, 4)}…redacted)` : "Not configured"}</dd>
          </div>
        </dl>
        <p className="muted small">
          Publishing an article does not guarantee Google indexing. Verify ownership in Search Console,
          submit /sitemap.xml, and request indexing manually where available. No automated indexing API is claimed.
        </p>
      </section>
    </>
  );
}
