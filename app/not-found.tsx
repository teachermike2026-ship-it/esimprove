import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t, href } = await getI18n();
  return (
    <div className="not-found">
      <span className="badge badge-neutral">404</span>
      <h1>{t("errors.notFoundTitle")}</h1>
      <p className="lead">{t("errors.notFoundBody")}</p>
      <div className="hero-actions">
        <Link className="button" href={href("/")}>
          {t("common.goHome")}
        </Link>
        <Link className="button button-secondary" href={href("/plans")}>
          {t("common.browsePlans")}
        </Link>
      </div>
    </div>
  );
}
