"use client";

import Link from "next/link";
import { AlertIcon, RetryIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, href } = useI18n();
  return (
    <div className="not-found">
      <span className="badge badge-danger">{t("errors.errorBadge")}</span>
      <h1>{t("errors.errorTitle")}</h1>
      <p className="lead">{t("errors.errorBody")}</p>
      <div className="callout callout-warning">
        <AlertIcon className="inline-icon" />
        <p>
          {t("errors.errorCallout")}
          {error.digest ? ` ${t("errors.reference", { reference: error.digest })}` : ""}
        </p>
      </div>
      <div className="hero-actions">
        <button className="button" type="button" onClick={reset}>
          <RetryIcon className="inline-icon" /> {t("common.retry")}
        </button>
        <Link className="button button-secondary" href={href("/")}>
          {t("common.goHome")}
        </Link>
      </div>
    </div>
  );
}
