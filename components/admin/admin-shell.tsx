"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icons";
import { logoutAction } from "@/lib/auth/actions";

export interface ShellNavItem {
  href: string;
  label: string;
  icon?: string;
  badgeCount?: number;
  badgeTone?: "neutral" | "danger";
  statusDot?: "ok" | "error" | "unknown";
}

export interface ShellNavGroup {
  label: string;
  items: ShellNavItem[];
}

export interface ShellProps {
  groups: ShellNavGroup[];
  environment: { label: string; tone: "live" | "sandbox" | "local"; detail: string };
  systemStatus: { tone: "ok" | "warn" | "error"; title: string; detail: string; href: string };
  alertsCount: number;
  admin: { name: string; email: string; role: string };
  children: ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function NavLinks({ groups, onNavigate }: { groups: ShellNavGroup[]; onNavigate: () => void }) {
  const pathname = usePathname() ?? "/admin";
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab");
  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (query) return pathname === path && tab === new URLSearchParams(query).get("tab");
    if (path === "/admin") return pathname === "/admin";
    if (path === "/admin/analytics") return pathname === path && tab !== "funnel";
    if (path === "/admin/plans") return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };
  return (
    <>
      {groups.map((group, index) => (
        <div className={`as-nav-group${index > 0 ? " as-nav-secondary" : ""}`} key={group.label}>
          {index > 0 ? <p className="as-nav-label">{group.label}</p> : null}
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`as-nav-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                {item.icon ? <AdminIcon name={item.icon as AdminIconName} size={19} /> : <span className="as-nav-bullet" />}
                <span className="as-nav-text">{item.label}</span>
                {item.badgeCount ? (
                  <span className={`as-badge${item.badgeTone === "danger" ? " is-danger" : ""}`}>{item.badgeCount}</span>
                ) : null}
                {item.statusDot ? <span className={`as-dot is-${item.statusDot}`} title={`Supplier: ${item.statusDot}`} /> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function AdminShell({ groups, environment, systemStatus, alertsCount, admin, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("admin-global-search")?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`admin-shell${open ? " is-nav-open" : ""}`}>
      <aside className="as-sidebar" aria-label="Admin navigation">
        <div className="as-brand">
          <BrandMark href="/admin" light ariaLabel="Admin overview" />
          <button className="as-icon-button as-close" type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <AdminIcon name="close" />
          </button>
        </div>
        <nav className="as-nav">
          <Suspense fallback={null}>
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
          </Suspense>
        </nav>
        <Link href={systemStatus.href} className={`as-status is-${systemStatus.tone}`}>
          <span className={`as-dot is-${systemStatus.tone === "ok" ? "ok" : systemStatus.tone === "warn" ? "unknown" : "error"}`} />
          <span>
            <strong>{systemStatus.title}</strong>
            <span>{systemStatus.detail}</span>
          </span>
          <AdminIcon name="chevron" size={16} style={{ transform: "rotate(-90deg)" }} />
        </Link>
      </aside>
      <button className="as-scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} />

      <div className="as-main">
        <header className="as-header">
          <button className="as-icon-button as-menu" type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <AdminIcon name="menu" />
          </button>
          <form className="as-search" action="/admin/search" role="search">
            <AdminIcon name="search" size={18} />
            <label className="sr-only" htmlFor="admin-global-search">
              Search orders, customers, plans
            </label>
            <input id="admin-global-search" name="q" type="search" placeholder="Search orders, customers, plans…" autoComplete="off" />
            <kbd>Ctrl K</kbd>
          </form>
          <div className="as-header-actions">
            <span className={`as-env is-${environment.tone}`} title={environment.detail}>
              <span className="as-dot is-ok" />
              {environment.label}
            </span>
            <Link className="as-icon-button as-bell" href="/admin/alerts" aria-label={`Alerts (${alertsCount} unresolved)`}>
              <AdminIcon name="bell" size={20} />
              {alertsCount > 0 ? <span className="as-bell-dot" /> : null}
            </Link>
            <Link className="as-icon-button" href="/admin/help" aria-label="Help center">
              <AdminIcon name="help" size={20} />
            </Link>
            <details className="as-profile">
              <summary>
                <span className="as-avatar">{initials(admin.name)}</span>
                <span className="as-profile-text">
                  <strong>{admin.name}</strong>
                  <span>{admin.role}</span>
                </span>
                <AdminIcon name="chevron" size={16} />
              </summary>
              <div className="as-profile-menu">
                <p className="small muted">{admin.email}</p>
                <Link href="/">
                  <AdminIcon name="external" size={16} /> View storefront
                </Link>
                <form action={logoutAction}>
                  <button type="submit">
                    <AdminIcon name="logout" size={16} /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="as-content" id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
