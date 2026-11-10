/**
 * Browser privacy-signal handling shared by the analytics client and tests.
 * These signals suppress optional analytics; they are never treated as consent.
 */
export interface PrivacySignals {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}

export function privacySignalsBlockAnalytics(signals: PrivacySignals): boolean {
  const dnt = (signals.doNotTrack ?? "").trim().toLowerCase();
  return dnt === "1" || dnt === "yes" || signals.globalPrivacyControl === true;
}

export function browserPrivacySignalsBlockAnalytics(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };
  const windowDnt =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { doNotTrack?: string }).doNotTrack;
  return privacySignalsBlockAnalytics({
    doNotTrack: nav.doNotTrack ?? windowDnt ?? nav.msDoNotTrack,
    globalPrivacyControl: nav.globalPrivacyControl === true,
  });
}
