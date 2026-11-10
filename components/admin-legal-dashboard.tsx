"use client";

import { useFormStatus } from "react-dom";
import { CheckIcon } from "@/components/icons";
import { CookieSettingsButton } from "@/components/analytics-tracker";
import {
  adminUnsubscribeAction,
  reviewPrivacyRequestAction,
  saveAccessibilityReviewAction,
  saveAssetAction,
  saveBusinessInfoAction,
  saveCookieConfigAction,
  saveDocumentSettingsAction,
  saveReadinessAction,
  saveRetentionAction,
  saveThirdPartyAction,
} from "@/app/admin/legal/actions";
import {
  ASSET_REVIEW_STATUSES,
  LEGAL_DOCUMENTS,
  LEGAL_REVIEW_STATUSES,
  businessProfileMissing,
} from "@/lib/legal";
import {
  formatLegalDate,
  legalStatusLabel,
  legalStatusTone,
} from "@/lib/legal-assets";
import { isAnalyticsRetentionKey } from "@/lib/retention";
import type {
  AccessibilityReviewRow,
  AssetLicenseRow,
  ConsentEventRow,
  CookieConsentRow,
  DataRetentionSettingRow,
  EmailSubscriptionRow,
  LegalDocumentVersionRow,
  LegalReadinessItemRow,
  LegalSettingsRow,
  LegalThirdPartyRow,
  PrivacyRequestRow,
} from "@/lib/db/schema";

const THIRD_PARTY_STATUSES: readonly string[] = [
  ...LEGAL_REVIEW_STATUSES,
  "not_configured",
  "optional_not_configured",
];

const COMMERCIAL_USE_OPTIONS = [
  "allowed",
  "allowed_with_license",
  "unknown",
  "not_allowed",
] as const;

const REDISTRIBUTION_OPTIONS = [
  "allowed",
  "allowed_with_license",
  "unknown",
  "not_allowed",
] as const;

const PRIVACY_TYPE_LABELS: Record<string, string> = {
  access: "Access",
  correction: "Correction",
  deletion: "Deletion",
  restriction: "Restriction",
  portability: "Portability",
  objection: "Objection",
  other: "Other",
};

const PRIVACY_STATUS_LABELS: Record<string, string> = {
  pending_verification: "Pending verification",
  in_review: "In review",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function privacyStatusLabel(status: string): string {
  return PRIVACY_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function privacyStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "rejected") return "danger";
  if (status === "cancelled") return "neutral";
  return "warning";
}

function isClosedPrivacyStatus(status: string): boolean {
  return status === "completed" || status === "rejected" || status === "cancelled";
}

function formatTimestamp(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

function SubmitButton({
  children,
  pendingLabel,
  tone = "primary",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  tone?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-${tone}`} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${legalStatusTone(status)}`}>
      {legalStatusLabel(status)}
    </span>
  );
}

function PrivacyStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${privacyStatusTone(status)}`}>
      {privacyStatusLabel(status)}
    </span>
  );
}

function StatusSelect({
  id,
  name,
  defaultValue,
  options = LEGAL_REVIEW_STATUSES,
  label,
}: {
  id: string;
  name: string;
  defaultValue: string;
  options?: readonly string[];
  label: string;
}) {
  const values = options.includes(defaultValue)
    ? options
    : [defaultValue, ...options];
  return (
    <select id={id} name={name} defaultValue={defaultValue} aria-label={label}>
      {values.map((value) => (
        <option key={value} value={value}>
          {legalStatusLabel(value)}
        </option>
      ))}
    </select>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="muted small">{children}</p>;
}

function Notice({
  notice,
  errorMessage,
}: {
  notice: string | null;
  errorMessage: string | null;
}) {
  if (errorMessage) {
    return (
      <div className="alert alert-error" role="alert">
        <strong>Change not saved.</strong> {errorMessage}
      </div>
    );
  }
  if (notice) {
    return (
      <div className="alert alert-ok" role="status">
        <strong>Saved.</strong> {notice}
      </div>
    );
  }
  return null;
}

export interface AdminLegalDashboardProps {
  settings: LegalSettingsRow;
  documents: LegalDocumentVersionRow[];
  thirdParties: LegalThirdPartyRow[];
  assets: AssetLicenseRow[];
  retention: DataRetentionSettingRow[];
  analyticsRetention: {
    eventsDays: number;
    aggregatesDays: number;
    eventsSource: string;
    aggregatesSource: string;
    eventsEnabled: boolean;
    aggregatesEnabled: boolean;
  };
  reviews: AccessibilityReviewRow[];
  readiness: LegalReadinessItemRow[];
  consentEvents: ConsentEventRow[];
  cookieConsents: CookieConsentRow[];
  privacyRequests: PrivacyRequestRow[];
  subscriptions: EmailSubscriptionRow[];
  notice: string | null;
  errorMessage: string | null;
}

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
  notice,
  errorMessage,
}: AdminLegalDashboardProps) {
  const missingBusiness = businessProfileMissing(settings);
  const openPrivacyRequests = privacyRequests.filter(
    (request) => !isClosedPrivacyStatus(request.status),
  );
  const incompleteReadiness = readiness.filter((item) => item.status !== "complete");
  const unresolvedAssets = assets.filter((asset) => asset.status !== "complete");

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Governance</p>
          <h1>Legal &amp; compliance</h1>
          <p className="muted">
            Owner-supplied identity, legal configuration, privacy requests, consent evidence,
            retention, accessibility, and asset licensing. No legal conclusion is inferred.
          </p>
        </div>
        <span className="badge badge-warning">Owner and legal review required</span>
      </div>

      <Notice notice={notice} errorMessage={errorMessage} />

      <div className="stat-grid">
        <article className="card stat">
          <span>Missing required business fields</span>
          <strong>{missingBusiness.length}</strong>
          <p className="muted small">Never filled with invented information.</p>
        </article>
        <article className="card stat">
          <span>Open privacy requests</span>
          <strong>{openPrivacyRequests.length}</strong>
          <p className="muted small">Identity must be verified before completion.</p>
        </article>
        <article className="card stat">
          <span>Readiness items incomplete</span>
          <strong>{incompleteReadiness.length}</strong>
          <p className="muted small">Owner, legal, and technical evidence.</p>
        </article>
        <article className="card stat">
          <span>Assets without verified rights</span>
          <strong>{unresolvedAssets.length}</strong>
          <p className="muted small">Confirm commercial use before launch.</p>
        </article>
      </div>

      <nav aria-label="Legal dashboard sections" className="section-tight">
        <div className="pill-row">
          <a className="button button-ghost button-small" href="#business">Business identity</a>
          <a className="button button-ghost button-small" href="#documents">Documents</a>
          <a className="button button-ghost button-small" href="#third-parties">Third parties</a>
          <a className="button button-ghost button-small" href="#retention">Retention</a>
          <a className="button button-ghost button-small" href="#privacy">Privacy requests</a>
          <a className="button button-ghost button-small" href="#unsubscribe">Unsubscribe</a>
          <a className="button button-ghost button-small" href="#accessibility">Accessibility</a>
          <a className="button button-ghost button-small" href="#assets">Assets</a>
          <a className="button button-ghost button-small" href="#readiness">Readiness</a>
          <a className="button button-ghost button-small" href="#consent">Consent evidence</a>
        </div>
      </nav>

      <section id="business" className="card form section-tight" aria-labelledby="business-heading">
        <h2 id="business-heading">Business identity and contacts</h2>
        <p className="muted small">
          Enter only verified owner information. Blank required fields are displayed as missing
          and are not replaced with placeholders.
        </p>
        {missingBusiness.length === 0 ? (
          <div className="alert alert-ok" role="status">
            <CheckIcon className="inline-icon" /> All required business fields are configured.
            Legal review of the documents is still required.
          </div>
        ) : (
          <div className="alert alert-warn" role="status">
            <strong>Missing required information:</strong>{" "}
            {missingBusiness.map((entry) => entry.label).join(", ")}.
          </div>
        )}

        <form action={saveBusinessInfoAction} className="stack">
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="legalName">Legal business name</label>
              <input id="legalName" name="legalName" type="text" maxLength={200} defaultValue={settings.legalName} />
            </div>
            <div className="field">
              <label htmlFor="tradingName">Trading name</label>
              <input id="tradingName" name="tradingName" type="text" maxLength={200} defaultValue={settings.tradingName} />
            </div>
            <div className="field">
              <label htmlFor="registrationNumber">Business registration number</label>
              <input id="registrationNumber" name="registrationNumber" type="text" maxLength={100} defaultValue={settings.registrationNumber} />
            </div>
            <div className="field">
              <label htmlFor="businessCountry">Business country</label>
              <input id="businessCountry" name="businessCountry" type="text" maxLength={100} defaultValue={settings.businessCountry} />
            </div>
            <div className="field">
              <label htmlFor="contactEmail">Contact email</label>
              <input id="contactEmail" name="contactEmail" type="email" maxLength={254} defaultValue={settings.contactEmail} />
            </div>
            <div className="field">
              <label htmlFor="supportEmail">Customer support email</label>
              <input id="supportEmail" name="supportEmail" type="email" maxLength={254} defaultValue={settings.supportEmail} />
            </div>
            <div className="field">
              <label htmlFor="privacyContact">Privacy contact email</label>
              <input id="privacyContact" name="privacyContact" type="email" maxLength={254} defaultValue={settings.privacyContact} />
            </div>
            <div className="field">
              <label htmlFor="phone">Telephone number</label>
              <input id="phone" name="phone" type="text" maxLength={80} defaultValue={settings.phone} />
            </div>
            <div className="field">
              <label htmlFor="legalContact">Legal contact</label>
              <input id="legalContact" name="legalContact" type="text" maxLength={300} defaultValue={settings.legalContact} />
            </div>
            <div className="field">
              <label htmlFor="jurisdiction">Applicable jurisdiction</label>
              <input id="jurisdiction" name="jurisdiction" type="text" maxLength={200} defaultValue={settings.jurisdiction} />
            </div>
            <div className="field">
              <label htmlFor="vatNumber">VAT or tax registration number</label>
              <input id="vatNumber" name="vatNumber" type="text" maxLength={100} defaultValue={settings.vatNumber} />
            </div>
            <div className="field">
              <label htmlFor="minimumAge">Minimum age (optional)</label>
              <input id="minimumAge" name="minimumAge" type="number" min={1} max={120} defaultValue={settings.minimumAge ?? ""} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="registeredAddress">Registered business address</label>
            <textarea id="registeredAddress" name="registeredAddress" rows={3} maxLength={1000} defaultValue={settings.registeredAddress} />
          </div>
          <div className="field">
            <label htmlFor="taxDetails">Tax details</label>
            <textarea id="taxDetails" name="taxDetails" rows={2} maxLength={1000} defaultValue={settings.taxDetails} />
          </div>
          <div className="field">
            <label htmlFor="minimumAgeNote">Minimum age note</label>
            <textarea id="minimumAgeNote" name="minimumAgeNote" rows={2} maxLength={1000} defaultValue={settings.minimumAgeNote} />
          </div>
          <label className="checkbox">
            <input type="checkbox" name="confirmVerified" required />
            <span>I confirm these details are accurate, owner-provided, and safe to publish.</span>
          </label>
          <div className="actions">
            <SubmitButton pendingLabel="Saving business details…">Save business details</SubmitButton>
          </div>
        </form>
      </section>

      <section id="documents" className="card form section-tight" aria-labelledby="documents-heading">
        <h2 id="documents-heading">Legal documents and versions</h2>
        <p className="muted small">
          Versions and effective dates are administrative metadata. A document is publishable only
          when its review status is complete, an effective date exists, and the business identity is
          complete.
        </p>
        <form action={saveDocumentSettingsAction} className="stack">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Version</th>
                  <th scope="col">Review status</th>
                  <th scope="col">Effective date</th>
                </tr>
              </thead>
              <tbody>
                {LEGAL_DOCUMENTS.map((document) => (
                  <tr key={document.key}>
                    <td>
                      <strong>{document.title}</strong>
                      <br />
                      <span className="small muted">{document.path}</span>
                    </td>
                    <td>
                      <input
                        type="text"
                        name={`${document.key}Version`}
                        defaultValue={settings[document.versionField]}
                        maxLength={80}
                        required
                        aria-label={`${document.title} version`}
                      />
                    </td>
                    <td>
                      <StatusSelect
                        id={`${document.key}-status`}
                        name={`${document.key}Status`}
                        defaultValue={settings[document.statusField]}
                        label={`${document.title} review status`}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        name={`${document.key}EffectiveDate`}
                        defaultValue={settings[document.effectiveField] ?? ""}
                        aria-label={`${document.title} effective date`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions">
            <SubmitButton pendingLabel="Saving document settings…">Save document settings</SubmitButton>
          </div>
        </form>

        <h3>Recorded version history</h3>
        {documents.length === 0 ? (
          <EmptyState>No document versions have been recorded.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Version</th>
                  <th scope="col">Status</th>
                  <th scope="col">Effective</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>{document.documentKey.replaceAll("_", " ")}</td>
                    <td><code>{document.version}</code></td>
                    <td><StatusBadge status={document.status} /></td>
                    <td>{formatLegalDate(document.effectiveDate)}</td>
                    <td>{formatTimestamp(document.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3>Consent versions</h3>
        <form action={saveCookieConfigAction} className="stack">
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="cookieConsentVersion">Cookie consent version</label>
              <input
                id="cookieConsentVersion"
                name="cookieConsentVersion"
                type="text"
                maxLength={40}
                pattern="[A-Za-z0-9._-]+"
                defaultValue={settings.cookieConsentVersion}
                required
              />
              <p className="form-note">Letters, numbers, dots, underscores, or hyphens.</p>
            </div>
            <div className="field">
              <label htmlFor="marketingConsentVersion">Marketing consent version</label>
              <input
                id="marketingConsentVersion"
                name="marketingConsentVersion"
                type="text"
                maxLength={40}
                pattern="[A-Za-z0-9._-]+"
                defaultValue={settings.marketingConsentVersion}
                required
              />
            </div>
          </div>
          <div className="actions">
            <SubmitButton pendingLabel="Saving consent versions…" tone="secondary">
              Save consent versions
            </SubmitButton>
          </div>
        </form>
      </section>

      <section id="third-parties" className="section-tight" aria-labelledby="third-parties-heading">
        <h2 id="third-parties-heading">Third-party services and data sharing</h2>
        <p className="muted small">
          Records are seeded from the implemented architecture. Update provider, purpose, data,
          transfer, and consent behavior only from verified contracts and deployment facts.
        </p>
        {thirdParties.length === 0 ? (
          <EmptyState>No third-party services are registered.</EmptyState>
        ) : (
          <div className="stack">
            {thirdParties.map((thirdParty) => {
              const prefix = `third-party-${thirdParty.serviceKey}`;
              return (
                <details key={thirdParty.id} className="card section-tight">
                  <summary>
                    <strong>{thirdParty.provider}</strong>{" "}
                    <StatusBadge status={thirdParty.status} />{" "}
                    <span className="small muted">{thirdParty.serviceKey}</span>
                  </summary>
                  <form action={saveThirdPartyAction} className="form">
                    <input type="hidden" name="serviceKey" value={thirdParty.serviceKey} />
                    <div className="grid grid-2">
                      <div className="field">
                        <label htmlFor={`${prefix}-provider`}>Provider</label>
                        <input id={`${prefix}-provider`} name="provider" type="text" maxLength={200} defaultValue={thirdParty.provider} required />
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-status`}>Status</label>
                        <StatusSelect id={`${prefix}-status`} name="status" defaultValue={thirdParty.status} options={THIRD_PARTY_STATUSES} label="Third-party status" />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-purpose`}>Purpose</label>
                      <textarea id={`${prefix}-purpose`} name="purpose" rows={2} maxLength={1000} defaultValue={thirdParty.purpose} required />
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-data`}>Data shared</label>
                      <textarea id={`${prefix}-data`} name="dataShared" rows={2} maxLength={2000} defaultValue={thirdParty.dataShared} />
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-cookies`}>Cookies or storage</label>
                      <input id={`${prefix}-cookies`} name="cookies" type="text" maxLength={1000} defaultValue={thirdParty.cookies} />
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-transfer`}>International transfer</label>
                      <input id={`${prefix}-transfer`} name="internationalTransfer" type="text" maxLength={1000} defaultValue={thirdParty.internationalTransfer} />
                    </div>
                    <div className="pill-row">
                      <label className="checkbox">
                        <input type="checkbox" name="runsBeforeConsent" defaultChecked={thirdParty.runsBeforeConsent} />
                        <span>Runs before consent</span>
                      </label>
                      <label className="checkbox">
                        <input type="checkbox" name="necessary" defaultChecked={thirdParty.necessary} />
                        <span>Necessary</span>
                      </label>
                      <label className="checkbox">
                        <input type="checkbox" name="optional" defaultChecked={thirdParty.optional} />
                        <span>Optional</span>
                      </label>
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-notes`}>Configuration notes</label>
                      <textarea id={`${prefix}-notes`} name="configurationNotes" rows={2} maxLength={4000} defaultValue={thirdParty.configurationNotes} />
                    </div>
                    <div className="actions">
                      <SubmitButton pendingLabel="Saving third-party record…">Save third-party record</SubmitButton>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section id="retention" className="section-tight" aria-labelledby="retention-heading">
        <h2 id="retention-heading">Data retention</h2>
        <p className="muted small">
          Automated analytics cleanup is {analyticsRetention.eventsEnabled ? "enabled" : "disabled"} for
          raw events ({analyticsRetention.eventsDays} days, {analyticsRetention.eventsSource}) and{" "}
          {analyticsRetention.aggregatesEnabled ? "enabled" : "disabled"} for aggregates (
          {analyticsRetention.aggregatesDays} days, {analyticsRetention.aggregatesSource}). The
          395/730-day values are proposed technical defaults, not owner-approved periods. Cleanup
          only runs when both automation and enablement are selected and the period is valid. Other
          categories are manual until an approved job exists.
        </p>
        {retention.length === 0 ? (
          <EmptyState>No retention categories are registered.</EmptyState>
        ) : (
          <div className="stack">
            {retention.map((row) => {
              const supportsAutomation = isAnalyticsRetentionKey(row.dataKey);
              const prefix = `retention-${row.dataKey}`;
              return (
                <details key={row.id} className="card section-tight">
                  <summary>
                    <strong>{row.label}</strong>{" "}
                    <span className="badge badge-neutral">
                      {row.retentionDays === null ? "No period set" : `${row.retentionDays} days`}
                    </span>{" "}
                    {row.enabled && row.automated ? (
                      <span className="badge badge-success">Automated</span>
                    ) : row.enabled ? (
                      <span className="badge badge-danger">Enabled without automation</span>
                    ) : (
                      <span className="badge badge-warning">Manual</span>
                    )}
                  </summary>
                  <form action={saveRetentionAction} className="form">
                    <input type="hidden" name="dataKey" value={row.dataKey} />
                    <div className="grid grid-2">
                      <div className="field">
                        <label htmlFor={`${prefix}-days`}>Retention period (days)</label>
                        <input
                          id={`${prefix}-days`}
                          name="retentionDays"
                          type="number"
                          min={1}
                          max={36500}
                          defaultValue={row.retentionDays ?? ""}
                        />
                        <p className="form-note">Blank means no period is set. Valid values are 1–36500.</p>
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-basis`}>Basis</label>
                        <input id={`${prefix}-basis`} name="basis" type="text" maxLength={120} defaultValue={row.basis} required />
                      </div>
                    </div>
                    {supportsAutomation ? (
                      <>
                        <div className="pill-row">
                          <label className="checkbox">
                            <input type="checkbox" name="automated" defaultChecked={row.automated} />
                            <span>Automated cleanup is implemented for this category</span>
                          </label>
                          <label className="checkbox">
                            <input type="checkbox" name="enabled" defaultChecked={row.enabled} />
                            <span>Enable cleanup</span>
                          </label>
                        </div>
                        <p className="form-note">
                          Cleanup runs only when both boxes are selected. An unbalanced direct
                          database edit (enabled without automated) is treated as disabled by the
                          cleanup job.
                        </p>
                      </>
                    ) : (
                      <p className="form-note">
                        Automated cleanup is not implemented for this category. Keep it disabled
                        until an approved job exists.
                      </p>
                    )}
                    <div className="field">
                      <label htmlFor={`${prefix}-notes`}>Notes</label>
                      <textarea id={`${prefix}-notes`} name="notes" rows={2} maxLength={4000} defaultValue={row.notes} />
                    </div>
                    <div className="actions">
                      <SubmitButton pendingLabel="Saving retention settings…">Save retention settings</SubmitButton>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section id="privacy" className="card form section-tight" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Privacy requests</h2>
        <p className="muted small">
          Identity must be verified before any request is completed. Deletion anonymises the
          account profile and removes sessions and marketing preferences; financial, transaction,
          and audit records are retained where required. Access and portability requests require a
          manual response before they are marked complete.
        </p>
        {privacyRequests.length === 0 ? (
          <EmptyState>No privacy requests have been submitted.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Type</th>
                  <th scope="col">Requester</th>
                  <th scope="col">Status</th>
                  <th scope="col">Identity</th>
                  <th scope="col">Opened</th>
                </tr>
              </thead>
              <tbody>
                {privacyRequests.map((request) => (
                  <tr key={request.id}>
                    <td><code>{request.reference}</code></td>
                    <td>{PRIVACY_TYPE_LABELS[request.requestType] ?? request.requestType}</td>
                    <td>
                      {request.name || "No name supplied"}
                      <br />
                      <span className="small muted">{request.email}</span>
                    </td>
                    <td><PrivacyStatusBadge status={request.status} /></td>
                    <td>{request.identityStatus === "verified" ? "Verified" : "Unverified"}</td>
                    <td>{formatTimestamp(request.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3>Review and decisions</h3>
        {privacyRequests.length === 0 ? (
          <EmptyState>No requests are available for review.</EmptyState>
        ) : (
          <div className="stack">
            {privacyRequests.map((request) => {
              const closed = isClosedPrivacyStatus(request.status);
              const prefix = `privacy-${request.id}`;
              return (
                <details key={request.id} className="card section-tight">
                  <summary>
                    <strong>{request.reference}</strong> ·{" "}
                    {PRIVACY_TYPE_LABELS[request.requestType] ?? request.requestType} ·{" "}
                    <PrivacyStatusBadge status={request.status} />{" "}
                    <span className="small muted">{request.email}</span>
                  </summary>
                  <dl className="meta-list stacked">
                    <div><dt>Type</dt><dd>{PRIVACY_TYPE_LABELS[request.requestType] ?? request.requestType}</dd></div>
                    <div><dt>Status</dt><dd>{privacyStatusLabel(request.status)}</dd></div>
                    <div><dt>Identity</dt><dd>{request.identityStatus === "verified" ? `Verified ${formatTimestamp(request.verifiedAt)}` : "Unverified"}</dd></div>
                    <div><dt>Opened</dt><dd>{formatTimestamp(request.createdAt)}</dd></div>
                    <div><dt>Handled by</dt><dd>{request.handledBy || "Not yet assigned"}</dd></div>
                    <div><dt>Resolution</dt><dd>{request.resolution || "Not yet recorded"}</dd></div>
                    <div><dt>Rejection reason</dt><dd>{request.rejectionReason || "None"}</dd></div>
                    <div><dt>Admin notes</dt><dd>{request.adminNotes || "None"}</dd></div>
                  </dl>
                  <div className="field">
                    <span className="form-note">Requester details</span>
                    <p>{request.details || "No details supplied."}</p>
                  </div>

                  {closed ? (
                    <div className="alert alert-warn" role="status">
                      This request is closed. Further decisions are blocked to prevent duplicate
                      processing.
                    </div>
                  ) : (
                    <div className="stack">
                      {request.identityStatus !== "verified" ? (
                        <form action={reviewPrivacyRequestAction} className="stack-sm">
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="reviewAction" value="verify" />
                          <div className="field">
                            <label htmlFor={`${prefix}-verify-notes`}>Verification notes</label>
                            <textarea id={`${prefix}-verify-notes`} name="adminNotes" rows={2} maxLength={4000} defaultValue={request.adminNotes} />
                            <p className="form-note">
                              Confirm identity out of band before verifying. Verification does not
                              disclose or delete data.
                            </p>
                          </div>
                          <div className="actions">
                            <SubmitButton pendingLabel="Verifying…" tone="secondary">Verify identity</SubmitButton>
                          </div>
                        </form>
                      ) : null}

                      <form action={reviewPrivacyRequestAction} className="stack-sm">
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="reviewAction" value="complete" />
                        <div className="field">
                          <label htmlFor={`${prefix}-resolution`}>Resolution</label>
                          <textarea id={`${prefix}-resolution`} name="resolution" rows={3} maxLength={4000} defaultValue={request.resolution} />
                          <p className="form-note">
                            {request.requestType === "deletion"
                              ? "Completing this deletion anonymises the account profile, removes sessions, and retains financial records."
                              : "Record what was delivered or decided. Access and portability requests require a manual response first."}
                          </p>
                        </div>
                        <div className="field">
                          <label htmlFor={`${prefix}-complete-notes`}>Admin notes</label>
                          <textarea id={`${prefix}-complete-notes`} name="adminNotes" rows={2} maxLength={4000} defaultValue={request.adminNotes} />
                        </div>
                        {request.requestType === "deletion" ? (
                          <label className="checkbox">
                            <input type="checkbox" name="confirmDeletion" required />
                            <span>I confirm the retention-aware deletion and understand financial records are retained.</span>
                          </label>
                        ) : null}
                        <div className="actions">
                          <SubmitButton pendingLabel="Completing request…">Complete request</SubmitButton>
                        </div>
                      </form>

                      <form action={reviewPrivacyRequestAction} className="stack-sm">
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="reviewAction" value="reject" />
                        <div className="field">
                          <label htmlFor={`${prefix}-reject-reason`}>Rejection reason</label>
                          <textarea id={`${prefix}-reject-reason`} name="rejectionReason" rows={2} maxLength={1000} required />
                          <p className="form-note">A reason is required and is shown to the requester through status lookup.</p>
                        </div>
                        <div className="field">
                          <label htmlFor={`${prefix}-reject-notes`}>Admin notes</label>
                          <textarea id={`${prefix}-reject-notes`} name="adminNotes" rows={2} maxLength={4000} defaultValue={request.adminNotes} />
                        </div>
                        <div className="actions">
                          <SubmitButton pendingLabel="Rejecting…" tone="secondary">Reject request</SubmitButton>
                        </div>
                      </form>

                      <form action={reviewPrivacyRequestAction} className="stack-sm">
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="reviewAction" value="cancel" />
                        <div className="field">
                          <label htmlFor={`${prefix}-cancel-notes`}>Cancellation notes</label>
                          <textarea id={`${prefix}-cancel-notes`} name="adminNotes" rows={2} maxLength={4000} defaultValue={request.adminNotes} />
                        </div>
                        <div className="actions">
                          <SubmitButton pendingLabel="Cancelling…" tone="ghost">Cancel request</SubmitButton>
                        </div>
                      </form>
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section id="unsubscribe" className="card form section-tight" aria-labelledby="unsubscribe-heading">
        <h2 id="unsubscribe-heading">Email unsubscribe administration</h2>
        <p className="muted small">
          Unsubscribe is idempotent: an already-unsubscribed address keeps its original timestamp
          and reason. Email delivery remains disabled in this build.
        </p>
        <form action={adminUnsubscribeAction} className="stack-sm">
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="unsubscribe-email">Email address</label>
              <input id="unsubscribe-email" name="email" type="email" maxLength={254} required />
            </div>
            <div className="field">
              <label htmlFor="unsubscribe-reason">Reason</label>
              <input id="unsubscribe-reason" name="reason" type="text" maxLength={200} defaultValue="admin_action" />
            </div>
          </div>
          <div className="actions">
            <SubmitButton pendingLabel="Unsubscribing…" tone="secondary">Unsubscribe address</SubmitButton>
          </div>
        </form>

        <h3>Recent subscriptions</h3>
        {subscriptions.length === 0 ? (
          <EmptyState>No email subscriptions are recorded.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                  <th scope="col">Consent version</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td>{subscription.email}</td>
                    <td>
                      <span className={`badge ${subscription.status === "unsubscribed" ? "badge-neutral" : "badge-success"}`}>
                        {subscription.status}
                      </span>
                    </td>
                    <td>{subscription.source || "—"}</td>
                    <td>{subscription.consentVersion || "—"}</td>
                    <td>{formatTimestamp(subscription.updatedAt)}</td>
                    <td>{subscription.unsubscribeReason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="accessibility" className="section-tight" aria-labelledby="accessibility-heading">
        <h2 id="accessibility-heading">Accessibility reviews</h2>
        <p className="muted small">
          These are review records, not a certification. A completed review requires a reviewer name
          and findings.
        </p>
        {reviews.length === 0 ? (
          <EmptyState>No accessibility review areas are registered.</EmptyState>
        ) : (
          <div className="stack">
            {reviews.map((review) => {
              const prefix = `a11y-${review.area}`;
              return (
                <details key={review.id} className="card section-tight">
                  <summary>
                    <strong>{review.area.replaceAll("_", " ")}</strong>{" "}
                    <StatusBadge status={review.status} />{" "}
                    <span className="small muted">WCAG {review.wcagLevel}</span>
                  </summary>
                  <form action={saveAccessibilityReviewAction} className="form">
                    <input type="hidden" name="area" value={review.area} />
                    <div className="grid grid-2">
                      <div className="field">
                        <label htmlFor={`${prefix}-status`}>Status</label>
                        <StatusSelect id={`${prefix}-status`} name="status" defaultValue={review.status} label="Accessibility review status" />
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-checked-by`}>Checked by</label>
                        <input id={`${prefix}-checked-by`} name="checkedBy" type="text" maxLength={120} defaultValue={review.checkedBy ?? ""} />
                        <p className="form-note">Last checked: {formatTimestamp(review.checkedAt)}</p>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-findings`}>Findings</label>
                      <textarea id={`${prefix}-findings`} name="findings" rows={4} maxLength={4000} defaultValue={review.findings} />
                    </div>
                    <div className="actions">
                      <SubmitButton pendingLabel="Saving accessibility review…">Save accessibility review</SubmitButton>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section id="assets" className="section-tight" aria-labelledby="assets-heading">
        <h2 id="assets-heading">Asset licensing</h2>
        <p className="muted small">
          Do not mark an asset complete without a verified license reference. Unknown commercial
          use or redistribution rights remain visible in the register.
        </p>
        {assets.length === 0 ? (
          <EmptyState>No assets are registered.</EmptyState>
        ) : (
          <div className="stack">
            {assets.map((asset) => {
              const prefix = `asset-${asset.assetKey}`;
              return (
                <details key={asset.id} className="card section-tight">
                  <summary>
                    <strong>{asset.name}</strong>{" "}
                    <StatusBadge status={asset.status} />{" "}
                    <span className="small muted">{asset.category} · {asset.location || "no location"}</span>
                  </summary>
                  <form action={saveAssetAction} className="form">
                    <input type="hidden" name="assetKey" value={asset.assetKey} />
                    <div className="grid grid-2">
                      <div className="field">
                        <label htmlFor={`${prefix}-status`}>Status</label>
                        <StatusSelect id={`${prefix}-status`} name="status" defaultValue={asset.status} options={ASSET_REVIEW_STATUSES} label="Asset review status" />
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-license-name`}>License name</label>
                        <input id={`${prefix}-license-name`} name="licenseName" type="text" maxLength={200} defaultValue={asset.licenseName} />
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-source-url`}>Source URL</label>
                        <input id={`${prefix}-source-url`} name="sourceUrl" type="url" maxLength={500} defaultValue={asset.sourceUrl} />
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-license-url`}>License URL</label>
                        <input id={`${prefix}-license-url`} name="licenseUrl" type="url" maxLength={500} defaultValue={asset.licenseUrl} />
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-commercial`}>Commercial use</label>
                        <select id={`${prefix}-commercial`} name="commercialUse" defaultValue={asset.commercialUse}>
                          {COMMERCIAL_USE_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-redistribution`}>Redistribution</label>
                        <select id={`${prefix}-redistribution`} name="redistribution" defaultValue={asset.redistribution}>
                          {REDISTRIBUTION_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-attribution`}>Attribution</label>
                      <input id={`${prefix}-attribution`} name="attribution" type="text" maxLength={1000} defaultValue={asset.attribution} />
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-notes`}>Notes</label>
                      <textarea id={`${prefix}-notes`} name="notes" rows={2} maxLength={4000} defaultValue={asset.notes} />
                    </div>
                    <div className="actions">
                      <SubmitButton pendingLabel="Saving asset record…">Save asset record</SubmitButton>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section id="readiness" className="section-tight" aria-labelledby="readiness-heading">
        <h2 id="readiness-heading">Legal readiness checklist</h2>
        <p className="muted small">
          Completing an item records evidence; it does not grant legal approval. Owner, legal, and
          technical prerequisites remain external.
        </p>
        {readiness.length === 0 ? (
          <EmptyState>No readiness items are registered.</EmptyState>
        ) : (
          <div className="stack">
            {readiness.map((item) => {
              const prefix = `readiness-${item.itemKey}`;
              return (
                <details key={item.id} className="card section-tight">
                  <summary>
                    <strong>{item.label}</strong>{" "}
                    <StatusBadge status={item.status} />{" "}
                    <span className="small muted">{item.category} · {item.owner || "owner unset"}</span>
                  </summary>
                  <form action={saveReadinessAction} className="form">
                    <input type="hidden" name="itemKey" value={item.itemKey} />
                    <div className="grid grid-2">
                      <div className="field">
                        <label htmlFor={`${prefix}-status`}>Status</label>
                        <StatusSelect id={`${prefix}-status`} name="status" defaultValue={item.status} label="Readiness status" />
                      </div>
                      <div className="field">
                        <label htmlFor={`${prefix}-owner`}>Owner</label>
                        <input id={`${prefix}-owner`} name="owner" type="text" maxLength={120} defaultValue={item.owner} />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`${prefix}-notes`}>Evidence and notes</label>
                      <textarea id={`${prefix}-notes`} name="notes" rows={3} maxLength={4000} defaultValue={item.notes} />
                      <p className="form-note">A completed item requires a note describing the evidence.</p>
                    </div>
                    <div className="actions">
                      <SubmitButton pendingLabel="Saving readiness item…">Save readiness item</SubmitButton>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section id="consent" className="card form section-tight" aria-labelledby="consent-heading">
        <div className="admin-toolbar">
          <h2 id="consent-heading">Consent evidence</h2>
          <CookieSettingsButton />
        </div>
        <p className="muted small">
          Server-side evidence stores HMAC subject identifiers, not raw IP addresses. Recent rows
          are shown for operations; they are not a substitute for the retention policy.
        </p>

        <h3>Cookie consent records</h3>
        {cookieConsents.length === 0 ? (
          <EmptyState>No cookie consent records exist.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Subject hash</th>
                  <th scope="col">Version</th>
                  <th scope="col">Analytics</th>
                  <th scope="col">Marketing</th>
                  <th scope="col">Action</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {cookieConsents.map((consent) => (
                  <tr key={consent.id}>
                    <td><code>{consent.subjectHash.slice(0, 12)}…</code></td>
                    <td>{consent.consentVersion}</td>
                    <td>{consent.analytics ? "Granted" : "Denied"}</td>
                    <td>{consent.marketing ? "Granted" : "Denied"}</td>
                    <td>{consent.action.replaceAll("_", " ")}</td>
                    <td>{formatTimestamp(consent.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3>Recent consent events</h3>
        {consentEvents.length === 0 ? (
          <EmptyState>No consent events exist.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Version</th>
                  <th scope="col">Granted</th>
                  <th scope="col">Surface</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {consentEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.subjectType} · <code>{event.subjectId.slice(0, 12)}…</code></td>
                    <td>{event.purpose.replaceAll("_", " ")}</td>
                    <td>{event.version}</td>
                    <td>
                      <span className={`badge ${event.granted ? "badge-success" : "badge-neutral"}`}>
                        {event.granted ? "Granted" : "Withheld"}
                      </span>
                    </td>
                    <td>{event.surface || "—"}</td>
                    <td>{formatTimestamp(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
