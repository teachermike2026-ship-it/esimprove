import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { getOrCreateUserPreferences } from "@/lib/user-preferences";
import { formatDate } from "@/lib/money";
import { ProfileForm, RequestVerificationButton } from "@/components/profile-forms";
import { ChangePasswordForm } from "@/components/auth-forms";
import {
  AlertIcon,
  CheckIcon,
  HeadsetIcon,
  LockIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Profile and preferences",
  robots: { index: false, follow: false },
};

export default async function PortalProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; verification?: string }>;
}) {
  const user = await requireUser("/portal/profile");
  const { verified, verification } = await searchParams;
  const db = await getDb();
  const preferences = await getOrCreateUserPreferences(db, user.id);
  const isVerified = Boolean(user.emailVerifiedAt);

  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumbs">
          <li>
            <Link href="/portal">Portal</Link>
          </li>
          <li aria-current="page">Profile</li>
        </ol>
      </nav>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile and preferences</h1>
          <p className="muted">
            Manage your display name, communication preferences, email verification, and password.
          </p>
        </div>
        <span className={isVerified ? "badge" : "badge badge-warning"}>
          {isVerified ? "Email verified" : "Email not verified"}
        </span>
      </div>

      {verification === "sent" ? (
        <div className="callout callout-success section-tight" role="status">
          <CheckIcon className="inline-icon" />
          <p>
            Account created. You can manage your profile and preferences here.
          </p>
        </div>
      ) : null}
      {verified === "1" ? (
        <div className="callout callout-success section-tight" role="status">
          <CheckIcon className="inline-icon" />
          <p>Email address verified.</p>
        </div>
      ) : null}
      {verified === "invalid" ? (
        <div className="form-error section-tight" role="alert">
          <AlertIcon className="inline-icon" />
          <p>
            That verification link is invalid or has expired. Request a new verification email
            below.
          </p>
        </div>
      ) : null}

      <div className="split">
        <section className="stack" aria-labelledby="profile-settings">
          <h2 id="profile-settings">Settings</h2>
          <ProfileForm
            name={user.name}
            locale={preferences.locale}
            marketingOptIn={preferences.marketingOptIn}
            productUpdatesOptIn={preferences.productUpdatesOptIn}
            orderUpdatesOptIn={preferences.orderUpdatesOptIn}
          />
          <ChangePasswordForm />
        </section>

        <aside className="checkout-sidebar">
          <section className="card form">
            <h2>
              <UserIcon className="inline-icon" /> Account details
            </h2>
            <dl className="meta-list">
              <div>
                <dt>Name</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user.role}</dd>
              </div>
              <div>
                <dt>Verified</dt>
                <dd>
                  {user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : "Not verified"}
                </dd>
              </div>
            </dl>
            <p className="form-note">
              To change your sign-in email, contact us from the account email you want to keep at{" "}
              <a href="mailto:contact@esimprove.com">contact@esimprove.com</a>.
            </p>
          </section>

          <section className="card form">
            <h2>
              <ShieldIcon className="inline-icon" /> Email verification
            </h2>
            <RequestVerificationButton verified={isVerified} email={user.email} />
          </section>

          <section className="card form">
            <h2>
              <HeadsetIcon className="inline-icon" /> Help and privacy
            </h2>
            <div className="stack-sm">
              <Link className="button button-secondary" href="/portal/support">
                Support conversations
              </Link>
              <Link className="button button-ghost" href="/portal">
                Orders and eSIMs
              </Link>
              <Link className="button button-ghost" href="/legal/privacy">
                Privacy policy
              </Link>
              <Link className="button button-ghost" href="/legal/terms">
                Terms of service
              </Link>
            </div>
          </section>

          <section className="card form">
            <h2>
              <LockIcon className="inline-icon" /> Session security
            </h2>
            <p className="muted small">
              Changing your password signs out all other sessions. Sessions expire automatically.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
