"use client";

import { useActionState } from "react";
import type { SeoSettings } from "@/lib/seo";
import { saveSeoSettingsAction, type SeoActionState } from "./actions";

const initialState: SeoActionState = {};

export function SeoSettingsForm({ settings }: { settings: SeoSettings }) {
  const [state, formAction, pending] = useActionState(saveSeoSettingsAction, initialState);

  return (
    <form className="card form section-tight" action={formAction}>
      <h2>Global SEO settings</h2>
      {state.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state.ok ? <div className="alert alert-ok">SEO settings saved.</div> : null}

      <div className="meta-list stacked">
        <div>
          <label htmlFor="seo-siteName">Site name</label>
          <input id="seo-siteName" name="siteName" type="text" maxLength={100} required defaultValue={settings.siteName} />
        </div>
        <div>
          <label htmlFor="seo-homepageTitle">Homepage SEO title</label>
          <input id="seo-homepageTitle" name="homepageTitle" type="text" maxLength={200} required defaultValue={settings.homepageTitle} />
        </div>
        <div>
          <label htmlFor="seo-homepageDescription">Homepage meta description</label>
          <textarea id="seo-homepageDescription" name="homepageDescription" rows={3} maxLength={300} required defaultValue={settings.homepageDescription} />
        </div>
        <div>
          <label htmlFor="seo-titleTemplate">Default title template</label>
          <input id="seo-titleTemplate" name="titleTemplate" type="text" maxLength={200} required defaultValue={settings.titleTemplate} placeholder="{title} | {site_name}" />
          <p className="muted small">Use {"{title}"} and {"{site_name}"} as placeholders.</p>
        </div>
        <div>
          <label htmlFor="seo-canonicalBase">Canonical base URL</label>
          <input id="seo-canonicalBase" name="canonicalBase" type="url" required defaultValue={settings.canonicalBase} placeholder="https://esimprove.com" />
        </div>
        <div>
          <label htmlFor="seo-defaultOgImage">Default Open Graph image URL</label>
          <input id="seo-defaultOgImage" name="defaultOgImage" type="url" defaultValue={settings.defaultOgImage} placeholder="https://esimprove.com/og-default.png" />
        </div>
        <div>
          <label htmlFor="seo-defaultOgTitle">Default social-sharing title</label>
          <input id="seo-defaultOgTitle" name="defaultOgTitle" type="text" maxLength={200} defaultValue={settings.defaultOgTitle} />
        </div>
        <div>
          <label htmlFor="seo-defaultOgDescription">Default social-sharing description</label>
          <textarea id="seo-defaultOgDescription" name="defaultOgDescription" rows={3} maxLength={300} defaultValue={settings.defaultOgDescription} />
        </div>
        <div>
          <label htmlFor="seo-logoUrl">Logo URL</label>
          <input id="seo-logoUrl" name="logoUrl" type="url" defaultValue={settings.logoUrl} />
        </div>
        <div>
          <label htmlFor="seo-faviconUrl">Favicon URL</label>
          <input id="seo-faviconUrl" name="faviconUrl" type="url" defaultValue={settings.faviconUrl} />
        </div>
        <div>
          <label htmlFor="seo-organizationName">Organization name</label>
          <input id="seo-organizationName" name="organizationName" type="text" maxLength={200} defaultValue={settings.organizationName} />
        </div>
        <div>
          <label htmlFor="seo-organizationUrl">Organization URL</label>
          <input id="seo-organizationUrl" name="organizationUrl" type="url" defaultValue={settings.organizationUrl} />
        </div>
        <div>
          <label htmlFor="seo-organizationSameAs">Organization same-as links (one per line)</label>
          <textarea id="seo-organizationSameAs" name="organizationSameAs" rows={3} defaultValue={settings.organizationSameAs.join("\n")} placeholder="https://x.com/esimprove" />
        </div>
        <div>
          <label htmlFor="seo-robotsDefault">Default robots directive</label>
          <select id="seo-robotsDefault" name="robotsDefault" defaultValue={settings.robotsDefault}>
            <option value="index, follow">index, follow</option>
            <option value="index, nofollow">index, nofollow</option>
            <option value="noindex, follow">noindex, follow</option>
            <option value="noindex, nofollow">noindex, nofollow</option>
          </select>
        </div>
        <div>
          <label htmlFor="seo-indexDefault">Index search engines by default</label>
          <input id="seo-indexDefault" name="indexDefault" type="checkbox" defaultChecked={settings.indexDefault} />
        </div>
        <div>
          <label htmlFor="seo-gscVerificationToken">Google Search Console verification token</label>
          <input id="seo-gscVerificationToken" name="gscVerificationToken" type="text" maxLength={100} defaultValue={settings.gscVerificationToken ?? ""} placeholder="content token only (not the full meta tag)" />
          <p className="muted small">Stored server-side and rendered only as a verification meta tag on public pages.</p>
        </div>
        <div>
          <label htmlFor="seo-gscProperty">Google Search Console property</label>
          <input id="seo-gscProperty" name="gscProperty" type="text" maxLength={500} defaultValue={settings.gscProperty} placeholder="https://esimprove.com" />
        </div>
        <div>
          <label htmlFor="seo-ga4MeasurementId">Google Analytics 4 measurement ID (optional)</label>
          <input id="seo-ga4MeasurementId" name="ga4MeasurementId" type="text" maxLength={30} defaultValue={settings.ga4MeasurementId} placeholder="G-XXXXXXXXXX" />
        </div>
      </div>

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save SEO settings"}
        </button>
      </div>
    </form>
  );
}
