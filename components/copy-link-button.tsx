"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

/** Copies a private link to the clipboard (falls back to selecting it). */
export function CopyLinkButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button button-secondary button-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt(label, value);
        }
      }}
    >
      {copied ? <CheckIcon className="inline-icon" /> : <CopyIcon className="inline-icon" />}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
