"use client";

import { useMemo, useState } from "react";
import {
  deviceBrands,
  type CompatibilityLevel,
} from "@/lib/compatibility";
import { AlertIcon, CheckIcon, QrIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

export function CompatibilityChecker() {
  const { t } = useI18n();
  const [brandId, setBrandId] = useState("apple");
  const [modelId, setModelId] = useState("iphone-xr-xs-later");
  const [result, setResult] = useState<{
    level: CompatibilityLevel;
    name: string;
    note: string;
  } | null>(null);

  const brand = useMemo(
    () => deviceBrands.find((item) => item.id === brandId) ?? deviceBrands[0],
    [brandId],
  );
  const model = brand.models.find((item) => item.id === modelId) ?? brand.models[0];

  const levelLabel = (level: CompatibilityLevel) =>
    level === "likely"
      ? t("compatibility.levelLikely")
      : level === "unsupported"
        ? t("compatibility.levelUnsupported")
        : t("compatibility.levelCheck");

  function check() {
    setResult({ level: model.level, name: `${brand.name} — ${model.name}`, note: model.note });
  }

  return (
    <div className="compat-grid">
      <form
        className="card form"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <div className="field">
          <label htmlFor="compat-brand">{t("compatibility.brandLabel")}</label>
          <select
            id="compat-brand"
            value={brandId}
            onChange={(event) => {
              const nextBrand = deviceBrands.find((item) => item.id === event.target.value);
              setBrandId(event.target.value);
              setModelId(nextBrand?.models[0]?.id ?? "");
              setResult(null);
            }}
          >
            {deviceBrands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="compat-model">{t("compatibility.modelLabel")}</label>
          <select
            id="compat-model"
            value={modelId}
            onChange={(event) => {
              setModelId(event.target.value);
              setResult(null);
            }}
          >
            {brand.models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">
          <QrIcon className="inline-icon" /> {t("compatibility.check")}
        </button>
        <p className="form-note">{t("compatibility.formNote")}</p>
      </form>

      <div className="card compat-result" aria-live="polite">
        {result ? (
          <>
            <span className={`badge ${result.level === "likely" ? "badge-success" : "badge-warning"}`}>
              {levelLabel(result.level)}
            </span>
            <h2>{result.name}</h2>
            <p>{result.note}</p>
            <div className="callout callout-warning">
              <AlertIcon className="inline-icon" />
              <p>{t("compatibility.verifyTitle")}</p>
            </div>
          </>
        ) : (
          <>
            <span className="badge badge-neutral">{t("compatibility.guidance")}</span>
            <h2>{t("compatibility.emptyTitle")}</h2>
            <p>{t("compatibility.emptyBody")}</p>
            <ul className="check-list">
              <li>
                <CheckIcon className="inline-icon" /> {t("compatibility.bullet1")}
              </li>
              <li>
                <CheckIcon className="inline-icon" /> {t("compatibility.bullet2")}
              </li>
              <li>
                <CheckIcon className="inline-icon" /> {t("compatibility.bullet3")}
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
