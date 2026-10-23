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
  return (
    <span className={`badge ${TONES[status] ?? "badge-neutral"}`}>
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
