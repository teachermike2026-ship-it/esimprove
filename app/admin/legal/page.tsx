import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/guards";
import { listLegalDocumentVersions } from "@/lib/legal-assets";
import { listAccessibilityReviews, listAssetLicenses, listLegalReadinessItems, listLegalThirdParties, listRetentionSettings } from "@/lib/legal-assets";
import { listRecentConsentEvents, listRecentCookieConsents } from "@/lib/consent";
import { listPrivacyRequests } from "@/lib/privacy-requests";
import { listEmailSubscriptions } from "@/lib/email-subscriptions";
import { loadLegalSettings } from "@/lib/legal";
import { loadAnalyticsRetentionPolicy } from "@/lib/retention";
import { AdminLegalDashboard } from "@/components/admin-legal-dashboard";

export const metadata: Metadata = {
  title: "Legal & compliance",
  description: "Governance checklist and published legal content.",
  alternates: { canonical: "/legal" },
};

export const dynamic = "force-dynamic";

export default async function AdminLegalPage() {
  await requireAdmin("/admin/legal");
  const db = await getDb();
  const settings = await loadLegalSettings(db);
  const documents = await listLegalDocumentVersions(db);
  const thirdParties = await listLegalThirdParties(db);
  const assets = await listAssetLicenses(db);
  const retention = await listRetentionSettings(db);
  const analyticsRetention = await loadAnalyticsRetentionPolicy(db);
  const reviews = await listAccessibilityReviews(db);
  const readiness = await listLegalReadinessItems(db);
  const consentEvents = await listRecentConsentEvents(db, 25);
  const cookieConsents = await listRecentCookieConsents(db, 30);
  const privacyRequests = await listPrivacyRequests(db, 50);
  const subscriptions = await listEmailSubscriptions(db, 50);

  return (
    <AdminLegalDashboard
      settings={settings}
      documents={documents}
      thirdParties={thirdParties}
      assets={assets}
      retention={retention}
      analyticsRetention={analyticsRetention}
      reviews={reviews}
      readiness={readiness}
      consentEvents={consentEvents}
      cookieConsents={cookieConsents}
      privacyRequests={privacyRequests}
      subscriptions={subscriptions}
    />
  );
}