import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth-forms";
import { UserIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/portal");

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <p className="eyebrow">Customer account</p>
        <h1>Create your account</h1>
        <p className="lead">
          An account keeps your orders together and lets you reopen activation details
          without a guest link. It does not create a real customer record for any live service.
        </p>
        <ul className="check-list">
          <li>
            <UserIcon className="inline-icon" /> Use a fictional email address if you prefer.
          </li>
          <li>
            <UserIcon className="inline-icon" /> Verify your email from your profile once you sign in.
          </li>
          <li>
            <UserIcon className="inline-icon" /> You can still check out as a guest.
          </li>
        </ul>
      </section>
      <section className="auth-form">
        <RegisterForm />
        <p className="form-note" style={{ textAlign: "center" }}>
          Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </section>
    </div>
  );
}
