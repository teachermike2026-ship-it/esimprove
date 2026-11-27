import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { OAuthButtons, OAuthLegalNote } from "@/components/oauth-buttons";
import { oauthAvailability } from "@/lib/auth/oauth";
import { ArrowRight, CheckIcon, LockIcon, UserIcon } from "@/components/icons";

/**
 * First checkout step for visitors who are not signed in: continue with an
 * account (Google / Apple, or email and password), or as a guest with no
 * personal details at all.
 */
export async function CheckoutEntry({
  totalLabel,
  itemCount,
}: {
  totalLabel: string;
  itemCount: number;
}) {
  const { t, href } = await getI18n();
  const checkoutPath = href("/checkout");
  const guestPath = `${checkoutPath}?as=guest`;
  const loginPath = `${href("/login")}?next=${encodeURIComponent(checkoutPath)}`;
  const oauth = oauthAvailability();
  const hasOAuth = oauth.google || oauth.apple;

  return (
    <section className="checkout-entry" aria-labelledby="checkout-entry-title">
      <div className="checkout-entry-head">
        <p className="eyebrow">{t("checkout.eyebrow")}</p>
        <h1 id="checkout-entry-title">{t("checkoutEntry.title")}</h1>
        <p className="muted">{t("checkoutEntry.summary", { count: itemCount, total: totalLabel })}</p>
      </div>

      <div className="checkout-entry-grid">
        <article className="card checkout-entry-card">
          <span className="checkout-entry-icon" aria-hidden="true">
            <UserIcon />
          </span>
          <h2>{t("checkoutEntry.accountTitle")}</h2>
          <p className="muted">{t("checkoutEntry.accountLead")}</p>
          <OAuthButtons next={checkoutPath} />
          <OAuthLegalNote />
          {hasOAuth ? (
            <p className="checkout-entry-alt">
              <Link href={loginPath}>{t("checkoutEntry.emailSignIn")}</Link>
            </p>
          ) : (
            <Link className="button button-secondary button-wide" href={loginPath}>
              {t("auth.signIn")} <ArrowRight className="inline-icon" />
            </Link>
          )}
        </article>

        <article className="card checkout-entry-card checkout-entry-guest">
          <span className="checkout-entry-icon" aria-hidden="true">
            <LockIcon />
          </span>
          <h2>{t("checkoutEntry.guestTitle")}</h2>
          <p className="muted">{t("checkoutEntry.guestLead")}</p>
          <ul className="checkout-entry-points">
            <li>
              <CheckIcon className="inline-icon" /> {t("checkoutEntry.guestPoint1")}
            </li>
            <li>
              <CheckIcon className="inline-icon" /> {t("checkoutEntry.guestPoint2")}
            </li>
            <li>
              <CheckIcon className="inline-icon" /> {t("checkoutEntry.guestPoint3")}
            </li>
          </ul>
          <Link className="button button-wide" href={guestPath}>
            {t("checkoutEntry.guestButton")} <ArrowRight className="inline-icon" />
          </Link>
        </article>
      </div>
    </section>
  );
}
