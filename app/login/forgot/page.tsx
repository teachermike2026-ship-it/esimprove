import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { demoMode, mockCommerceAllowed } from "@/lib/config";
import { LockIcon, MailIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">Account security</p>
        <h1>Reset your password</h1>
        <p className="lead">
          Enter the email address for your Esimprove demo account and we will generate a one-time
          password reset link.
        </p>
        <ul className="check-list">
          <li>
            <MailIcon className="inline-icon" /> Reset links expire after 30 minutes and are single
            use.
          </li>
          <li>
            <LockIcon className="inline-icon" /> The new password must be at least 10 characters.
          </li>
        </ul>
        {!mockCommerceAllowed ? (
          <div className="callout callout-warning">
            <p>
              Password reset email is unavailable in this deployment because no live email
              provider and verified sending domain are configured. Contact support for account
              help.
            </p>
          </div>
        ) : demoMode ? (
          <div className="callout callout-warning">
            <p>
              Demo mode: reset links are delivered through the local mock transport. No real email
              is sent and no live delivery provider is configured.
            </p>
          </div>
        ) : null}
      </section>
      <section className="auth-form">
        <ForgotPasswordForm />
        <p className="form-note" style={{ textAlign: "center" }}>
          Remembered it? <Link href="/login">Back to sign in</Link>.
        </p>
      </section>
    </div>
  );
}
