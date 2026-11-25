"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-wrap">
      <button
        className="button button-secondary button-small"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <CheckIcon className="inline-icon" /> : <CopyIcon className="inline-icon" />}
        {copied ? t("copy.copied") : (label ?? t("copy.copy"))}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {copied ? t("copy.announce") : ""}
      </span>
    </div>
  );
}
