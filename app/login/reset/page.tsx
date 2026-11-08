import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { LockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const tokenValue = token ?? "";

  return (
    <div className="auth-layout auth-layout-narrow">
      <section className="auth-copy">
        <p className="eyebrow">Account security</p>
        <h1>Choose a new password</h1>
        <p className="lead">
          Set a new password for your demo account. After a reset, all existing sessions are
          invalidated.
        </p>
        <div className="callout">
          <LockIcon className="inline-icon" />
          <p>
            Reset links are single use and expire quickly. If the link expired, request a new one
            from the account security page.
          </p>
        </div>
      </section>
      <section className="auth-form">
        <ResetPasswordForm token={tokenValue} />
        <p className="form-note" style={{ textAlign: "center" }}>
          Remembered it? <Link href="/login">Back to sign in</Link>.
        </p>
      </section>
    </div>
  );
}
