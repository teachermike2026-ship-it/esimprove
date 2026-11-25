"use client";

import { useI18n } from "@/components/i18n-provider";

const TONES: Record<string, string> = {
  paid: "badge-success",
  delivered: "badge-success",
  ready_to_install: "badge-success",
  processing: "badge-warning",
  provisioning: "badge-warning",
  queued: "badge-warning",
  pending: "badge-warning",
  pending_payment: "badge-warning",
  failed: "badge-danger",
  cancelled: "badge-neutral",
  refunded: "badge-neutral",
  not_started: "badge-neutral",
  under_investigation: "badge-danger",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useI18n();
  const key = `status.${status}`;
  const translated = t(key);
  const text = label ?? (translated === key ? status.replaceAll("_", " ") : translated);
  return <span className={`badge ${TONES[status] ?? "badge-neutral"}`}>{text}</span>;
}
