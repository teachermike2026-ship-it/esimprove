import { getI18n } from "@/lib/i18n/server";
import { oauthAvailability } from "@/lib/auth/oauth";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}


/**
 * "Continue with Google / Apple". Plain links (not forms) so the browser
 * navigates to our start endpoint, which redirects to the provider.
 * A provider without configured credentials is not shown.
 */
/**
 * Providers offered in the interface. Apple sign-in stays implemented on the
 * server (lib/auth/oauth.ts) but is not offered for now.
 */
const OFFERED_PROVIDERS = ["google"] as const;

/** True when at least one offered provider has credentials configured. */
export function oauthOffered(): boolean {
  const available = oauthAvailability();
  return OFFERED_PROVIDERS.some((provider) => available[provider]);
}

export async function OAuthButtons({ next }: { next: string }) {
  const { t } = await getI18n();
  // Only configured providers are shown; with none configured the section is
  // omitted, so customers never see a button that does nothing.
  if (!oauthOffered()) return null;
  return (
    <div className="oauth-buttons">
      <a
        className="oauth-button oauth-google"
        href={`/api/auth/oauth/google/start?next=${encodeURIComponent(next)}`}
        rel="nofollow"
      >
        <GoogleMark />
        <span>{t("oauth.continueGoogle")}</span>
      </a>
    </div>
  );
}

/** Legal notice shown next to the Google / Apple buttons. */
export async function OAuthLegalNote() {
  const { t, href } = await getI18n();
  if (!oauthOffered()) return null;
  return (
    <p className="form-note oauth-legal">
      {t("oauth.legalPrefix")}{" "}
      <a href={href("/legal/terms")} target="_blank" rel="noreferrer">
        {t("checkout.termsLink")}
      </a>{" "}
      {t("oauth.legalAnd")}{" "}
      <a href={href("/legal/privacy")} target="_blank" rel="noreferrer">
        {t("checkout.privacyLink")}
      </a>
      {t("oauth.legalSuffix")}
    </p>
  );
}
