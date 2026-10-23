"use client";

import { useMemo, useState } from "react";
import {
  compatibilityLabel,
  deviceBrands,
  type CompatibilityLevel,
} from "@/lib/compatibility";
import { AlertIcon, CheckIcon, QrIcon } from "@/components/icons";

export function CompatibilityChecker() {
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
          <label htmlFor="compat-brand">Device brand</label>
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
          <label htmlFor="compat-model">Device family or model</label>
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
          <QrIcon className="inline-icon" /> Check demo compatibility
        </button>
        <p className="form-note">
          This checker uses a small illustrative list. It is not an official compatibility
          database and does not guarantee that a device or carrier will accept an eSIM.
        </p>
      </form>

      <div className="card compat-result" aria-live="polite">
        {result ? (
          <>
            <span className={`badge ${result.level === "likely" ? "badge-success" : "badge-warning"}`}>
              {compatibilityLabel(result.level)}
            </span>
            <h2>{result.name}</h2>
            <p>{result.note}</p>
            <div className="callout callout-warning">
              <AlertIcon className="inline-icon" />
              <p>
                Before buying any real plan, confirm eSIM support with the manufacturer and
                check that the device is carrier-unlocked.
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="badge badge-demo">Illustrative data</span>
            <h2>Check the device, then check the settings</h2>
            <p>
              Choose a brand and model family. The result is a cautious guide, not a
              certification. The most reliable check is the device&apos;s own option to add a
              mobile plan.
            </p>
            <ul className="check-list">
              <li>
                <CheckIcon className="inline-icon" /> Look for “Add eSIM” or “Add mobile plan”.
              </li>
              <li>
                <CheckIcon className="inline-icon" /> Confirm the phone is carrier-unlocked.
              </li>
              <li>
                <CheckIcon className="inline-icon" /> Keep the QR code until installation is
                complete.
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
