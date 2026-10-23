export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return <span className="badge badge-demo">{label}</span>;
}
