import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/validation";
import { demoMode } from "@/lib/config";
import { LockIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(next, user.role === "admin" ? "/admin" : "/portal"));
  const nextPath = safeNextPath(next, "/portal");

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <p className="eyebrow">Customer account</p>
        <h1>Sign in to your demo account</h1>
        <p className="lead">
          Keep your demo orders in one place, reopen activation details, and see the order
          timeline. This local build does not send verification email.
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
        {demoMode ? (
          <div className="callout callout-warning">
            <p>
              Demo operator account: <code>admin@demo.local</code>. The password and TOTP
              secret are in your local <code>.env.local</code>. Run{" "}
              <code>npm run totp</code> to print the current code.
            </p>
          </div>
        ) : null}
      </section>
      <section className="auth-form">
        <LoginForm next={nextPath} />
        <p className="form-note" style={{ textAlign: "center" }}>
          No account? <Link href="/register">Create a customer account</Link>.
        </p>
      </section>
    </div>
  );
}
