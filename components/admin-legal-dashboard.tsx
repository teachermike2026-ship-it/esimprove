"use client";

import { CheckIcon } from "@/components/icons";
import { formatLegalDate, legalStatusLabel, legalStatusTone } from "@/lib/legal-assets";
import type { AnalyticsRetentionPolicy } from "@/lib/retention";
import { CookieSettingsButton } from "@/components/analytics-tracker";

export function AdminLegalDashboard({
  settings,
  documents,
  thirdParties,
  assets,
  retention,
  analyticsRetention,
  reviews,
  readiness,
  consentEvents,
  cookieConsents,
  privacyRequests,
  subscriptions,
}: {
  settings: any;
  documents: any[];
  thirdParties: any[];
  assets: any[];
  retention: any[];
  analyticsRetention: AnalyticsRetentionPolicy;
  reviews: any[];
  readiness: any[];
  consentEvents: any[];
  cookieConsents: any[];
  privacyRequests: any[];
  subscriptions: any[];
}) {
  return (
    <section className="card form section-tight">
      <h2>Legal documents</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Version</th>
              <th scope="col">Effective date</th>
              <th scope="col">Review status</th>
              <th scope="col">Publishable</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.documentKey.replaceAll("_", " ")}</td>
                <td>{doc.version}</td>
                <td>{formatLegalDate(doc.effectiveDate)}</td>
                <td><span className={`badge ${legalStatusTone(doc.status)}`}>{legalStatusLabel(doc.status)}</span></td>
                <td>{doc.status === "complete" ? <CheckIcon /> : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Cookie consent</h3>
      <p>{cookieConsents[0]?.analytics ? "Analytics granted" : "Analytics denied or missing"}</p>
      <p>Latest action: {cookieConsents[0]?.action || "none"} · Version: {cookieConsents[0]?.consentVersion || "none"}</p>

      <h3>Retention settings</h3>
      <p>
        Automated analytics policy: raw events {analyticsRetention.eventsDays} days (
        {analyticsRetention.eventsSource}); aggregated sessions and visitors{" "}
        {analyticsRetention.aggregatesDays} days ({analyticsRetention.aggregatesSource}).
      </p>

      <h3>Consent events history</h3>
      <p>Most recent events recorded in consent_events table.</p>

      <CookieSettingsButton />
    </section>
  );
}