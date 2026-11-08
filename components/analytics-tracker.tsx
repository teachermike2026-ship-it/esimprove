"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  LEGACY_CONSENT_STORAGE_KEY,
  consentIsAnalyticsGranted,
  type ConsentAction,
  type ConsentCategories,
  type StoredConsent,
} from "@/lib/legal";

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
  if (navigator.doNotTrack === "1" || (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true) {
    return;
  }

  const visitorId = getStorageId(window.localStorage, VISITOR_KEY);
  const sessionId = getStorageId(window.sessionStorage, SESSION_KEY);
  if (!visitorId || !sessionId) return;

  const payload = {
    visitorId,
    sessionId,
    events: events.map((event) => ({
      ...event,
      path: event.path ?? path,
      referrer: event.referrer ?? (document.referrer || undefined),
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
  const stored = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  const active = stored && stored.version === consentVersion ? stored : null;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

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
            <h2 id="consent-banner-title">Your privacy choices</h2>
            <p id="consent-banner-description">
              We use essential storage to keep sign-in and security working. Optional
              first-party analytics is off until you allow it. GA4, if the owner configures it,
              only loads after analytics consent.{" "}
              <a href="/legal/cookies">Cookie policy</a> ·{" "}
              <a href="/legal/privacy">Privacy policy</a>
            </p>
          </div>
          <div className="consent-banner-actions">
            <button className="button" type="button" onClick={() => decide("reject_non_essential")}>
              Reject non-essential
            </button>
            <button className="button" type="button" onClick={() => decide("accept_all")}>
              Accept all
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
              Customise
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
          <h2 id="consent-dialog-title">Cookie and tracking preferences</h2>
          <button
            className="button button-ghost button-small"
            type="button"
            onClick={onClose}
            aria-label="Close cookie preferences"
          >
            Close
          </button>
        </div>
        <p id="consent-dialog-description" className="small muted">
          Choices are stored on this device with a version and timestamp. A missing or outdated
          choice is never treated as consent. You can reopen this panel from the footer at any
          time.
        </p>

        <div className="consent-category">
          <div>
            <h3>Strictly necessary</h3>
            <p className="small muted">
              Sign-in sessions, cart continuity, security, and consent storage. These are
              required for the site to work.
            </p>
          </div>
          <label className="consent-switch">
            <input type="checkbox" checked disabled readOnly aria-label="Strictly necessary storage is always active" />
            <span>Always active</span>
          </label>
        </div>

        <div className="consent-category">
          <div>
            <h3>Analytics</h3>
            <p className="small muted">
              Optional first-party page and event analytics using HMAC identifiers. If GA4 is
              configured, Google Analytics also loads only after this choice. No advertising or
              marketing trackers are installed in this build.
            </p>
          </div>
          <label className="consent-switch">
            <input
              type="checkbox"
              name="analytics"
              defaultChecked={analytics}
              aria-describedby="analytics-consent-help"
            />
            <span>Allow analytics</span>
          </label>
          <span id="analytics-consent-help" className="visually-hidden">
            Optional. The site works without analytics.
          </span>
        </div>

        <div className="consent-category consent-category-muted">
          <div>
            <h3>Marketing</h3>
            <p className="small muted">
              No marketing cookies, pixels, or advertising SDKs are installed. If that changes,
              the consent manager must be updated before any marketing script is loaded.
            </p>
          </div>
          <span className="badge badge-neutral">Not used</span>
        </div>

        <div className="consent-dialog-actions">
          <button className="button" type="submit">
            Save preferences
          </button>
          <button className="button button-ghost" type="button" onClick={onWithdraw}>
            Withdraw optional consent
          </button>
          <button className="button button-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
        <p className="small muted">
          Withdrawal stops optional analytics immediately. Essential security and sign-in
          storage remains active. See the{" "}
          <a href="/legal/cookies">Cookie policy</a>.
        </p>
      </form>
    </dialog>
  );
}

export function CookieSettingsButton({
  className = "button button-ghost button-small",
  label = "Cookie settings",
}: {
  className?: string;
  label?: string;
}) {
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
      {label}
    </button>
  );
}

export function AnalyticsTracker({ consentVersion }: { consentVersion: string }) {
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  const consented = consentIsAnalyticsGranted(stored, consentVersion);
  const lastPage = useRef<string | null>(null);

  useEffect(() => {
    if (!consented || !pathname || isPrivatePath(pathname)) return;
    if (lastPage.current === pathname) return;
    lastPage.current = pathname;

    const events: EventInput[] = [
      { type: "page_view", path: pathname, title: document.title },
    ];
    if (pathname.startsWith("/blog/") && pathname.split("/").filter(Boolean).length > 1) {
      events.push({ type: "article_opened", path: pathname, title: document.title });
    }
    if (pathname.startsWith("/plans/")) {
      events.push({ type: "plan_viewed", path: pathname });
    }
    if (pathname.startsWith("/destinations/")) {
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
      if (!pathname || isPrivatePath(pathname)) return;
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
        if (href.startsWith("/blog/") && !pathname?.startsWith("/blog/")) {
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

export function Ga4Loader({ measurementId }: { measurementId: string }) {
  const stored = useSyncExternalStore(subscribe, getConsentSnapshot, getServerSnapshot);
  const consented = Boolean(measurementId && stored?.categories.analytics);
  const measurementKey = measurementId;

  useEffect(() => {
    if (typeof window === "undefined" || !measurementKey) return;
    const disableKey = `ga-disable-${measurementKey}`;
    if (!consented) {
      (window as unknown as Record<string, boolean>)[disableKey] = true;
      return;
    }

    (window as unknown as Record<string, boolean>)[disableKey] = false;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag =
      window.gtag ??
      function gtag(...args: unknown[]) {
        window.dataLayer!.push(args);
      };
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
      document.head.appendChild(script);
    }
  }, [consented, measurementKey]);

  return null;
}
