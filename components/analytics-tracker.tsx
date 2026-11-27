"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  LEGACY_CONSENT_STORAGE_KEY,
  consentIsAnalyticsGranted,
  consentIsCurrent,
  type ConsentAction,
  type ConsentCategories,
  type StoredConsent,
} from "@/lib/legal";
import { browserPrivacySignalsBlockAnalytics } from "@/lib/privacy-signals";
import { minimizedReferrer, attributionReferrer } from "@/lib/referrer";
import { splitLocalePath } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n-provider";

const CONSENT_ACTIONS = new Set<ConsentAction>([
  "accept_all",
  "reject_non_essential",
  "custom",
  "withdraw",
]);

const CONSENT_ID_KEY = "es_consent_id";
const SESSION_KEY = "es_analytics_session";
const VISITOR_KEY = "es_analytics_visitor";
const PRIVATE_PREFIXES = [
  "/admin",
  "/portal",
  "/orders",
  "/checkout",
  "/cart",
  "/login",
  "/register",
  "/privacy/request",
];

/**
 * Purchase-funnel steps on private pages:
 * destination_viewed -> plan_viewed -> cart_viewed -> checkout_started -> order_created.
 */
const FUNNEL_STEPS: Array<{ type: string; path: string; match: (path: string) => boolean }> = [
  { type: "cart_viewed", path: "/cart", match: (path) => path === "/cart" },
  { type: "checkout_started", path: "/checkout", match: (path) => path === "/checkout" },
  {
    type: "order_created",
    path: "/checkout/payment",
    match: (path) => path.startsWith("/checkout/crypto/") || path.startsWith("/checkout/pay"),
  },
];

type EventInput = {
  type: string;
  path?: string;
  title?: string;
  gameId?: string;
  referrer?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

declare global {
  interface Window {
    esimproveTrack?: (
      type: string,
      options?: Omit<EventInput, "type" | "path"> & { path?: string },
    ) => void;
    esimproveOpenConsent?: () => void;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __esimproveGa4Id?: string;
  }
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedConsent: StoredConsent | null = null;

function parseConsent(raw: string | null): StoredConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.version !== "string" || typeof parsed.timestamp !== "string") return null;
    if (Number.isNaN(Date.parse(parsed.timestamp))) return null;
    if (!CONSENT_ACTIONS.has(parsed.action as ConsentAction)) return null;
    const categories = parsed.categories as Partial<ConsentCategories> | undefined;
    if (!categories || typeof categories.analytics !== "boolean") return null;
    return {
      version: parsed.version,
      timestamp: parsed.timestamp,
      action: (parsed.action as ConsentAction) ?? "custom",
      categories: {
        necessary: true,
        analytics: categories.analytics === true,
        marketing: categories.marketing === true,
      },
    };
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getConsentSnapshot(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw();
  if (raw === cachedRaw) return cachedConsent;
  cachedRaw = raw;
  cachedConsent = parseConsent(raw);
  return cachedConsent;
}

function getServerSnapshot(): StoredConsent | null {
  return null;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function emitChange(): void {
  cachedRaw = undefined;
  for (const listener of listeners) listener();
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT));
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.padEnd(32, "0");
}

function getConsentId(): string {
  try {
    let value = window.localStorage.getItem(CONSENT_ID_KEY);
    if (!value || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
      value = randomId();
      window.localStorage.setItem(CONSENT_ID_KEY, value);
    }
    return value;
  } catch {
    return randomId();
  }
}

async function sendConsentRecord(
  consent: StoredConsent,
  action: ConsentAction,
): Promise<void> {
  try {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consentId: getConsentId(),
        consentVersion: consent.version,
        action,
        categories: consent.categories,
      }),
      credentials: "same-origin",
      keepalive: true,
    });
  } catch {
    // A failed consent record must not break navigation. The local choice still
    // suppresses analytics until a server record can be written.
  }
}

function storeConsent(
  version: string,
  categories: ConsentCategories,
  action: ConsentAction,
): StoredConsent {
  const consent: StoredConsent = {
    version,
    timestamp: new Date().toISOString(),
    action,
    categories: {
      necessary: true,
      analytics: categories.analytics === true,
      marketing: categories.marketing === true,
    },
  };
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
    window.localStorage.removeItem(LEGACY_CONSENT_STORAGE_KEY);
  } catch {
    // Storage can be blocked. In that case the in-memory event still prevents
    // analytics for the current page, but the choice will not persist.
  }
  emitChange();
  void sendConsentRecord(consent, action);
  return consent;
}

function getStorageId(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  let value = storage.getItem(key);
  if (!value || value.length < 8) {
    value = randomId();
    storage.setItem(key, value);
  }
  return value;
}

function isPrivatePath(path: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function sendEvents(
  events: EventInput[],
  path: string,
  consentVersion: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const consent = getConsentSnapshot();
  if (!consentIsAnalyticsGranted(consent, consentVersion)) return;
  if (browserPrivacySignalsBlockAnalytics()) return;

  const visitorId = getStorageId(window.localStorage, VISITOR_KEY);
  const sessionId = getStorageId(window.sessionStorage, SESSION_KEY);
  if (!visitorId || !sessionId) return;

  const payload = {
    visitorId,
    sessionId,
    events: events.map((event) => ({
      ...event,
      path: event.path ?? path,
      referrer:
        (event.referrer
          ? minimizedReferrer(event.referrer)
          : attributionReferrer(document.referrer, window.location.search)) ?? undefined,
    })),
  };

  const headers = {
    "content-type": "application/json",
    "x-es-consent-id": getConsentId(),
  };

  try {
    const response = await fetch("/api/track", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "same-origin",
    });
    if (response.status === 403 || response.status === 204) {
      // The server may not have the consent record yet (for example immediately
      // after accepting the banner). Retry once after writing it again.
      const current = getConsentSnapshot();
      if (current && consentIsAnalyticsGranted(current, consentVersion)) {
        await sendConsentRecord(current, current.action);
        await fetch("/api/track", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          keepalive: true,
          credentials: "same-origin",
        });
      }
    }
  } catch {
    // Analytics must never break the page.
  }
}

export function ConsentManager({ consentVersion }: { consentVersion: string }) {
  const { t, href } = useI18n();
  const stored = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  const active = stored && consentIsCurrent(stored, consentVersion) ? stored : null;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Re-check periodically so a choice that expires while the page is open
    // causes the banner to return without requiring a reload.
    const timer = window.setInterval(() => {
      const current = getConsentSnapshot();
      if (current && !consentIsCurrent(current, consentVersion)) emitChange();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [consentVersion]);

  useEffect(() => {
    // One-time migration from the older granted/denied flag. A missing value is
    // never treated as consent.
    try {
      const legacy = window.localStorage.getItem(LEGACY_CONSENT_STORAGE_KEY);
      const current = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!current && (legacy === "granted" || legacy === "denied")) {
        storeConsent(
          consentVersion,
          { necessary: true, analytics: legacy === "granted", marketing: false },
          "custom",
        );
        window.localStorage.removeItem(LEGACY_CONSENT_STORAGE_KEY);
      }
    } catch {
      // Ignore blocked storage.
    }
  }, [consentVersion]);

  useEffect(() => {
    function openDialog() {
      const dialog = dialogRef.current;
      if (!dialog) return;
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) dialog.showModal();
    }
    window.esimproveOpenConsent = openDialog;
    window.addEventListener(CONSENT_OPEN_EVENT, openDialog);
    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, openDialog);
      window.esimproveOpenConsent = undefined;
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      if (dialog?.open) dialog.close();
      restoreFocusRef.current?.focus?.();
    }
    dialog.addEventListener("cancel", handleClose);
    return () => dialog.removeEventListener("cancel", handleClose);
  }, []);

  function decide(action: ConsentAction) {
    const categories: ConsentCategories = {
      necessary: true,
      analytics: action === "accept_all",
      marketing: false,
    };
    if (action === "custom") {
      const form = dialogRef.current?.querySelector("form");
      const input = form?.querySelector<HTMLInputElement>('input[name="analytics"]');
      categories.analytics = input?.checked === true;
    }
    storeConsent(consentVersion, categories, action);
    if (dialogRef.current?.open) dialogRef.current.close();
    restoreFocusRef.current?.focus?.();
  }

  function withdraw() {
    storeConsent(
      consentVersion,
      { necessary: true, analytics: false, marketing: false },
      "withdraw",
    );
    if (dialogRef.current?.open) dialogRef.current.close();
    restoreFocusRef.current?.focus?.();
  }

  if (!active) {
    return (
      <>
        <aside
          className="consent-banner"
          aria-labelledby="consent-banner-title"
          aria-describedby="consent-banner-description"
        >
          <div className="consent-banner-copy">
            <h2 id="consent-banner-title">{t("consent.title")}</h2>
            <p id="consent-banner-description">
              {t("consent.description")}{" "}
              <a href={href("/legal/cookies")}>{t("consent.cookiePolicy")}</a> ·{" "}
              <a href={href("/legal/privacy")}>{t("consent.privacyPolicy")}</a>
            </p>
          </div>
          <div className="consent-banner-actions">
            <button className="button" type="button" onClick={() => decide("reject_non_essential")}>
              {t("consent.reject")}
            </button>
            <button className="button" type="button" onClick={() => decide("accept_all")}>
              {t("consent.accept")}
            </button>
            <button
              className="button button-ghost"
              type="button"
              onClick={() => {
                const dialog = dialogRef.current;
                if (!dialog) return;
                restoreFocusRef.current = document.activeElement as HTMLElement | null;
                if (!dialog.open) dialog.showModal();
              }}
            >
              {t("consent.customize")}
            </button>
          </div>
        </aside>
        <ConsentPreferencesDialog
          dialogRef={dialogRef}
          analytics={false}
          onSave={() => decide("custom")}
          onWithdraw={withdraw}
          onClose={() => {
            if (dialogRef.current?.open) dialogRef.current.close();
            restoreFocusRef.current?.focus?.();
          }}
        />
      </>
    );
  }

  return (
    <>
      <ConsentPreferencesDialog
        dialogRef={dialogRef}
        analytics={active.categories.analytics}
        onSave={() => decide("custom")}
        onWithdraw={withdraw}
        onClose={() => {
          if (dialogRef.current?.open) dialogRef.current.close();
          restoreFocusRef.current?.focus?.();
        }}
      />
    </>
  );
}

function ConsentPreferencesDialog({
  dialogRef,
  analytics,
  onSave,
  onWithdraw,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  analytics: boolean;
  onSave: () => void;
  onWithdraw: () => void;
  onClose: () => void;
}) {
  const { t, href } = useI18n();
  const cookieLabel = t("consent.cookiePolicy");
  const noteText = t("consent.note", { cookiePolicy: cookieLabel });
  const noteIndex = noteText.indexOf(cookieLabel);
  return (
    <dialog
      ref={dialogRef}
      className="consent-dialog"
      aria-labelledby="consent-dialog-title"
      aria-describedby="consent-dialog-description"
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="consent-dialog-head">
          <h2 id="consent-dialog-title">{t("consent.dialogTitle")}</h2>
          <button
            className="button button-ghost button-small"
            type="button"
            onClick={onClose}
            aria-label={t("consent.closeAria")}
          >
            {t("common.close")}
          </button>
        </div>
        <p id="consent-dialog-description" className="small muted">
          {t("consent.dialogDescription")}
        </p>

        <div className="consent-category">
          <div>
            <h3>{t("consent.necessary")}</h3>
            <p className="small muted">{t("consent.necessaryBody")}</p>
          </div>
          <label className="consent-switch">
            <input
              type="checkbox"
              checked
              disabled
              readOnly
              aria-label={t("consent.necessaryAria")}
            />
            <span>{t("consent.alwaysActive")}</span>
          </label>
        </div>

        <div className="consent-category">
          <div>
            <h3>{t("consent.analytics")}</h3>
            <p className="small muted">{t("consent.analyticsBody")}</p>
          </div>
          <label className="consent-switch">
            <input
              type="checkbox"
              name="analytics"
              defaultChecked={analytics}
              aria-describedby="analytics-consent-help"
            />
            <span>{t("consent.allowAnalytics")}</span>
          </label>
          <span id="analytics-consent-help" className="visually-hidden">
            {t("consent.analyticsBody")}
          </span>
        </div>

        <div className="consent-category consent-category-muted">
          <div>
            <h3>{t("consent.marketing")}</h3>
            <p className="small muted">{t("consent.marketingBody")}</p>
          </div>
          <span className="badge badge-neutral">{t("consent.notUsed")}</span>
        </div>

        <div className="consent-dialog-actions">
          <button className="button" type="submit">
            {t("consent.save")}
          </button>
          <button className="button button-ghost" type="button" onClick={onWithdraw}>
            {t("consent.withdraw")}
          </button>
          <button className="button button-ghost" type="button" onClick={onClose}>
            {t("consent.cancel")}
          </button>
        </div>
        <p className="small muted">
          {noteIndex === -1 ? (
            noteText
          ) : (
            <>
              {noteText.slice(0, noteIndex)}
              <a href={href("/legal/cookies")}>{cookieLabel}</a>
              {noteText.slice(noteIndex + cookieLabel.length)}
            </>
          )}
        </p>
      </form>
    </dialog>
  );
}

export function CookieSettingsButton({
  className = "button button-ghost button-small",
  label,
}: {
  className?: string;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <button
      className={className}
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
        }
      }}
    >
      {label ?? t("consent.settings")}
    </button>
  );
}

export function AnalyticsTracker({ consentVersion }: { consentVersion: string }) {
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  const consented = consentIsAnalyticsGranted(stored, consentVersion);
  const lastPage = useRef<string | null>(null);

  useEffect(() => {
    if (!consented || !pathname) return;
    if (lastPage.current === pathname) return;
    lastPage.current = pathname;
    // Funnel rules work on the path without its language prefix (/fr/plans/x).
    const base = splitLocalePath(pathname).pathname;

    // Purchase funnel on private pages: only a fixed step name and a generic
    // path are sent, never the page's own path (which may contain order ids).
    const funnelStep = FUNNEL_STEPS.find((step) => step.match(base));
    if (funnelStep) {
      void sendEvents([{ type: funnelStep.type, path: funnelStep.path }], funnelStep.path, consentVersion);
      return;
    }
    if (isPrivatePath(base)) return;

    const events: EventInput[] = [
      { type: "page_view", path: pathname, title: document.title },
    ];
    if (base === "/blog" || base.startsWith("/blog/category/") || base.startsWith("/blog/tag/")) {
      events.push({ type: "blog_viewed", path: pathname });
    } else if (base.startsWith("/blog/") && base.split("/").filter(Boolean).length > 1) {
      events.push({ type: "article_opened", path: pathname, title: document.title });
    }
    if (base.startsWith("/plans/")) {
      events.push({ type: "plan_viewed", path: pathname });
    }
    if (base.startsWith("/destinations/")) {
      events.push({ type: "destination_viewed", path: pathname });
    }
    void sendEvents(events, pathname, consentVersion);
  }, [pathname, consented, consentVersion]);

  useEffect(() => {
    if (!consented) {
      window.esimproveTrack = undefined;
      return;
    }

    window.esimproveTrack = (type, options) => {
      if (!pathname || isPrivatePath(splitLocalePath(pathname).pathname)) return;
      void sendEvents([{ type, path: options?.path ?? pathname, ...options }], pathname, consentVersion);
    };

    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-track], a");
      if (!target) return;

      const tracked = target.getAttribute("data-track");
      if (tracked) {
        const gameId = target.getAttribute("data-game-id") ?? undefined;
        void sendEvents(
          [
            {
              type: tracked,
              path: pathname ?? "/",
              gameId,
              metadata: {
                label: (target.getAttribute("aria-label") || target.textContent || "")
                  .trim()
                  .slice(0, 120),
              },
            },
          ],
          pathname ?? "/",
          consentVersion,
        );
        return;
      }

      if (target instanceof HTMLAnchorElement) {
        const href = target.getAttribute("href");
        if (!href) return;
        const targetBase = splitLocalePath(href.split(/[?#]/)[0] ?? href).pathname;
        const currentBase = splitLocalePath(pathname ?? "/").pathname;
        if (targetBase.startsWith("/blog/") && !currentBase.startsWith("/blog/")) {
          void sendEvents(
            [
              {
                type: "article_link_clicked",
                path: pathname ?? "/",
                metadata: { target: href.slice(0, 200) },
              },
            ],
            pathname ?? "/",
            consentVersion,
          );
        }
      }
    }

    function onSubmit(event: Event) {
      const form = event.target as HTMLFormElement | null;
      if (!form?.matches("[data-analytics-search]")) return;
      void sendEvents(
        [
          {
            type: "search_performed",
            path: pathname ?? "/",
            metadata: { surface: "search_form" },
          },
        ],
        pathname ?? "/",
        consentVersion,
      );
    }

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit, true);
      window.esimproveTrack = undefined;
    };
  }, [consented, pathname, consentVersion]);

  return null;
}

export function Ga4Loader({
  measurementId,
  consentVersion,
  nonce,
}: {
  measurementId: string;
  consentVersion: string;
  nonce?: string;
}) {
  const stored = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  const consented = Boolean(
    measurementId &&
      consentIsAnalyticsGranted(stored, consentVersion) &&
      !browserPrivacySignalsBlockAnalytics(),
  );
  const measurementKey = measurementId;

  useEffect(() => {
    if (typeof window === "undefined" || !measurementKey) return;
    const disableKey = `ga-disable-${measurementKey}`;
    if (!consented) {
      (window as unknown as Record<string, boolean>)[disableKey] = true;
      // Google's opt-out flag prevents further measurement. Removing the
      // injected script stops it from re-executing if the page is restored
      // from the back/forward cache.
      document
        .querySelectorAll(`script[data-esimprove-ga4="${measurementKey}"]`)
        .forEach((element) => element.remove());
      window.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_personalization: "denied",
        ad_user_data: "denied",
      });
      return;
    }

    (window as unknown as Record<string, boolean>)[disableKey] = false;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag =
      window.gtag ??
      function gtag(...args: unknown[]) {
        window.dataLayer!.push(args);
      };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_personalization: "denied",
      ad_user_data: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", measurementKey, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    if (!document.querySelector(`script[data-esimprove-ga4="${measurementKey}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementKey)}`;
      script.dataset.esimproveGa4 = measurementKey;
      if (nonce) script.nonce = nonce;
      document.head.appendChild(script);
    }
  }, [consented, measurementKey, nonce]);

  return null;
}
