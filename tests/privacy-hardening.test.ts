import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/lib/db/client";
import { cookieConsents } from "@/lib/db/schema";
import {
  getCookieConsent,
  hasAnalyticsConsent,
  recordCookieConsent,
} from "@/lib/consent";
import {
  CONSENT_VALIDITY_DAYS,
  consentIsAnalyticsGranted,
  consentIsCurrent,
  loadLegalSettings,
  type StoredConsent,
} from "@/lib/legal";
import { validateTrackingPayload } from "@/lib/analytics-web";
import { minimizedReferrer, referrerHost } from "@/lib/referrer";
import { privacySignalsBlockAnalytics } from "@/lib/privacy-signals";
import { makeTestDb } from "./helpers/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-01T12:00:00.000Z");

function storedConsent(overrides: Partial<StoredConsent> = {}): StoredConsent {
  return {
    version: "2026-01",
    timestamp: NOW.toISOString(),
    action: "accept_all",
    categories: { necessary: true, analytics: true, marketing: false },
    ...overrides,
  };
}

describe("consent lifecycle and referrer minimisation", () => {
  let handle: DatabaseHandle;
  let consentVersion: string;

  beforeAll(async () => {
    handle = await makeTestDb();
    consentVersion = (await loadLegalSettings(handle.db)).cookieConsentVersion;
  });

  beforeEach(async () => {
    await handle.db.delete(cookieConsents);
  });

  afterAll(async () => {
    await handle.close();
  });

  it("accepts only a current, non-withdrawn analytics grant", () => {
    expect(consentIsCurrent(storedConsent(), "2026-01", NOW)).toBe(true);
    expect(consentIsAnalyticsGranted(storedConsent(), "2026-01", NOW)).toBe(true);

    expect(consentIsCurrent(storedConsent(), "2026-02", NOW)).toBe(false);
    expect(consentIsAnalyticsGranted(storedConsent(), "2026-02", NOW)).toBe(false);

    const almostExpired = new Date(
      NOW.getTime() - CONSENT_VALIDITY_DAYS * DAY_MS + 60_000,
    ).toISOString();
    expect(consentIsCurrent(storedConsent({ timestamp: almostExpired }), "2026-01", NOW)).toBe(
      true,
    );

    const expired = new Date(NOW.getTime() - (CONSENT_VALIDITY_DAYS + 1) * DAY_MS).toISOString();
    expect(consentIsCurrent(storedConsent({ timestamp: expired }), "2026-01", NOW)).toBe(false);

    const future = new Date(NOW.getTime() + 10 * 60_000).toISOString();
    expect(consentIsCurrent(storedConsent({ timestamp: future }), "2026-01", NOW)).toBe(false);

    expect(consentIsCurrent(storedConsent({ timestamp: "not-a-date" }), "2026-01", NOW)).toBe(
      false,
    );
    expect(consentIsCurrent(null, "2026-01", NOW)).toBe(false);
  });

  it("never treats a withdrawal or rejection as analytics permission", () => {
    const withdrawn = storedConsent({ action: "withdraw" });
    expect(consentIsCurrent(withdrawn, "2026-01", NOW)).toBe(true);
    expect(consentIsAnalyticsGranted(withdrawn, "2026-01", NOW)).toBe(false);

    const rejected = storedConsent({
      action: "reject_non_essential",
      categories: { necessary: true, analytics: false, marketing: false },
    });
    expect(consentIsAnalyticsGranted(rejected, "2026-01", NOW)).toBe(false);

    const customNoAnalytics = storedConsent({
      action: "custom",
      categories: { necessary: true, analytics: false, marketing: true },
    });
    expect(consentIsAnalyticsGranted(customNoAnalytics, "2026-01", NOW)).toBe(false);
  });

  it("forcibly clears analytics on withdrawal and rejection in the database", async () => {
    const id = "consent_test_id_0001";
    const accepted = await recordCookieConsent(handle.db, {
      consentId: id,
      consentVersion,
      action: "accept_all",
      categories: { necessary: true, analytics: true, marketing: true },
    });
    expect(accepted.analytics).toBe(true);
    expect(await hasAnalyticsConsent(handle.db, id, consentVersion)).toBe(true);

    // Even if a caller supplies analytics=true, a withdrawal must clear it.
    const withdrawn = await recordCookieConsent(handle.db, {
      consentId: id,
      consentVersion,
      action: "withdraw",
      categories: { necessary: true, analytics: true, marketing: true },
    });
    expect(withdrawn.analytics).toBe(false);
    expect(withdrawn.marketing).toBe(false);
    expect(await hasAnalyticsConsent(handle.db, id, consentVersion)).toBe(false);

    const rejected = await recordCookieConsent(handle.db, {
      consentId: id,
      consentVersion,
      action: "reject_non_essential",
      categories: { necessary: true, analytics: true, marketing: true },
    });
    expect(rejected.analytics).toBe(false);
    expect(rejected.marketing).toBe(false);
    expect(await hasAnalyticsConsent(handle.db, id, consentVersion)).toBe(false);
  });

  it("rejects expired, future, and wrong-version server-side evidence", async () => {
    const id = "consent_test_id_0002";
    await recordCookieConsent(handle.db, {
      consentId: id,
      consentVersion,
      action: "custom",
      categories: { necessary: true, analytics: true, marketing: false },
    });
    expect(await hasAnalyticsConsent(handle.db, id, consentVersion)).toBe(true);
    expect(await hasAnalyticsConsent(handle.db, id, "other-version")).toBe(false);
    expect(
      await hasAnalyticsConsent(
        handle.db,
        id,
        consentVersion,
        new Date(Date.now() + (CONSENT_VALIDITY_DAYS + 1) * DAY_MS),
      ),
    ).toBe(false);
    expect(
      await hasAnalyticsConsent(
        handle.db,
        id,
        consentVersion,
        new Date(Date.now() - 10 * 60_000),
      ),
    ).toBe(false);
    await expect(
      recordCookieConsent(handle.db, {
        consentId: "short",
        consentVersion,
        action: "accept_all",
        categories: { necessary: true, analytics: true, marketing: false },
      }),
    ).rejects.toThrow("Invalid consent id");
    expect(await getCookieConsent(handle.db, id)).not.toBeNull();
  });

  it("stores only the source host for analytics referrers", () => {
    expect(minimizedReferrer("https://www.google.com/search?q=esim+japan#results")).toBe(
      "www.google.com",
    );
    expect(minimizedReferrer("https://user:secret@news.example.com:8443/travel?x=1")).toBe(
      "news.example.com",
    );
    expect(minimizedReferrer("www.facebook.com")).toBe("www.facebook.com");
    expect(minimizedReferrer("javascript:alert(1)")).toBeNull();
    expect(minimizedReferrer("not a url")).toBeNull();
    expect(minimizedReferrer(null)).toBeNull();
    expect(referrerHost("https://WWW.Example.COM/path")).toBe("www.example.com");

    const payload = validateTrackingPayload({
      visitorId: "visitor_privacy_01",
      sessionId: "session_privacy_01",
      events: [
        {
          type: "page_view",
          path: "/privacy-test",
          referrer: "https://www.google.com/search?q=secret#fragment",
        },
      ],
    });
    expect(payload?.events[0]?.referrer).toBe("www.google.com");
  });

  it("honours Do Not Track and Global Privacy Control", () => {
    expect(privacySignalsBlockAnalytics({ doNotTrack: "1" })).toBe(true);
    expect(privacySignalsBlockAnalytics({ doNotTrack: "yes" })).toBe(true);
    expect(privacySignalsBlockAnalytics({ globalPrivacyControl: true })).toBe(true);
    expect(privacySignalsBlockAnalytics({ doNotTrack: "0" })).toBe(false);
    expect(privacySignalsBlockAnalytics({})).toBe(false);
  });
});
