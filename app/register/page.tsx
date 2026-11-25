import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth-forms";
import { UserIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return localizedMetadata({
    path: "/register",
    title: t("auth.metaRegister"),
    robots: { index: false, follow: false },
  });
}

export default async function RegisterPage() {
  const { t, href } = await getI18n();
  const user = await getCurrentUser();
  if (user) redirect("/portal");

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <p className="eyebrow">{t("auth.customerAccount")}</p>
        <h1>{t("auth.registerTitle")}</h1>
        <p className="lead">{t("auth.registerLead")}</p>
        <ul className="check-list">
          <li>
            <UserIcon className="inline-icon" /> {t("auth.fictionalEmail")}
          </li>
          <li>
            <UserIcon className="inline-icon" /> {t("auth.verifyEmail")}
          </li>
          <li>
            <UserIcon className="inline-icon" /> {t("auth.guestCheckout")}
          </li>
        </ul>
      </section>
      <section className="auth-form">
        <RegisterForm />
        <p className="form-note" style={{ textAlign: "center" }}>
          {t("auth.alreadyHave")} <Link href={href("/login")}>{t("auth.signInLink")}</Link>.
        </p>
      </section>
    </div>
  );
}
