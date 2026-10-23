import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty-state card">
      <h2>{title}</h2>
      <div className="muted">{children}</div>
      {action ? (
        <Link className="button" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
