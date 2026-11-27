"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** True for the back office, which renders its own full-screen shell. */
export function isAdminPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/.test(pathname);
}

/**
 * Storefront chrome (header, page container, footer) around every page except
 * the admin, which uses the full viewport like the Reference B dashboard.
 * Header and footer stay server components; they are passed in as props.
 */
export function SiteChrome({ header, footer, children }: { header: ReactNode; footer: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  if (isAdminPath(pathname)) {
    return (
      <div id="main" className="admin-root">
        {children}
      </div>
    );
  }
  return (
    <>
      {header}
      <main id="main" className="container page-main">
        {children}
      </main>
      {footer}
    </>
  );
}
