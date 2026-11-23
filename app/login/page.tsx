import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/validation";
import { isAdminRole } from "@/lib/auth/roles";
import { CheckIcon, LockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string }>;
}) {
  const { next, verified } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(next, isAdminRole(user.role) ? "/admin" : "/portal"));
  const nextPath = safeNextPath(next, "/portal");

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <p className="eyebrow">Customer account</p>
        <h1>Sign in to your account</h1>
        <p className="lead">
          Keep your orders in one place, reopen activation details, and see the order
          timeline.
        </p>
        <ul className="check-list">
          <li>
            <LockIcon className="inline-icon" /> Passwords are hashed with scrypt.
          </li>
          <li>
            <LockIcon className="inline-icon" /> Sessions are database-backed and HTTP-only.
          </li>
          <li>
            <LockIcon className="inline-icon" /> Admin accounts also require a TOTP code.
          </li>
        </ul>
      </section>
      <section className="auth-form">
        {verified === "1" ? (
          <div className="callout callout-success" role="status">
            <CheckIcon className="inline-icon" />
            <p>Email verified. Sign in to continue to your account.</p>
          </div>
        ) : null}
        <LoginForm next={nextPath} />
        <p className="form-note" style={{ textAlign: "center" }}>
          No account? <Link href="/register">Create a customer account</Link>.{" "}
          <Link href="/login/forgot">Forgot password?</Link>
        </p>
      </section>
    </div>
  );
}
