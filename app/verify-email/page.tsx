import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailAction } from "@/lib/auth/actions";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;
  const tokenValue = token ?? "";

  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">Account security</p>
        <h1>Verify your email address</h1>
        <p className="lead">
          Confirming your address secures your account and keeps your contact details current. The
          link can only be used once.
        </p>
        <div className="callout">
          <MailIcon className="inline-icon" />
          <p>
            If you have not received a verification link, contact{" "}
            <a href="mailto:contact@esimprove.com">contact@esimprove.com</a> for assistance.
          </p>
        </div>
      </section>
      <section className="auth-form">
        {status === "invalid" ? (
          <div className="form-error" role="alert">
            <AlertIcon className="inline-icon" />
            <p>
              This verification link is invalid, already used, or expired. Sign in and request a
              new verification email from your profile page.
            </p>
          </div>
        ) : null}

        {tokenValue ? (
          <form action={verifyEmailAction} className="form card">
            <h2>Confirm this address</h2>
            <p className="muted small">
              Submit the form to mark the account email as verified. Email scanners that only open
              links cannot consume the token.
            </p>
            <input type="hidden" name="token" value={tokenValue} />
            <button className="button" type="submit">
              <CheckIcon className="inline-icon" />
              Verify email address
            </button>
          </form>
        ) : (
          <div className="card form">
            <h2>Verification link required</h2>
            <p className="muted">
              Open the verification link we sent you. If it is missing or has expired, sign in and
              request a new one from your profile page, or contact{" "}
              <a href="mailto:contact@esimprove.com">contact@esimprove.com</a>.
            </p>
          </div>
        )}

        <p className="form-note" style={{ textAlign: "center" }}>
          <Link href="/login">Back to sign in</Link>.{" "}
          <Link href="/portal/profile">Profile and security</Link>.
        </p>
      </section>
    </div>
  );
}
