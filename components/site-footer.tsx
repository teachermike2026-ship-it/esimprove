import Link from "next/link";
import { demoMode } from "@/lib/config";

export function SiteFooter() {
  const year = new Date().getUTCFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              e
            </span>
            <span className="brand-text">
              eSIM<span>prove</span>
            </span>
          </Link>
          <p>
            A demo-first eSIM travel storefront. Catalogue, prices, and activation data are
            illustrative unless a real supplier connection is approved and enabled.
          </p>
          {demoMode ? (
            <p className="footer-demo">
              Demo mode is on. No real payments, supplier orders, eSIMs, or emails.
            </p>
          ) : null}
        </div>
        <div>
          <h2 className="footer-heading">Shop</h2>
          <ul className="footer-links">
            <li>
              <Link href="/destinations">Destinations</Link>
            </li>
            <li>
              <Link href="/plans">All plans</Link>
            </li>
            <li>
              <Link href="/search">Search</Link>
            </li>
            <li>
              <Link href="/compatibility">Compatibility checker</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">Help</h2>
          <ul className="footer-links">
            <li>
              <Link href="/guides">Install guides</Link>
            </li>
            <li>
              <Link href="/portal">Customer portal</Link>
            </li>
            <li>
              <Link href="/legal/terms">Demo terms</Link>
            </li>
            <li>
              <Link href="/legal/privacy">Privacy draft</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">Operator</h2>
          <ul className="footer-links">
            <li>
              <Link href="/legal/refunds">Refund policy draft</Link>
            </li>
            <li>
              <Link href="/api/health">Health status</Link>
            </li>
            {demoMode ? (
              <li>
                <Link href="/admin">Demo admin</Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>© {year} eSIMprove demo. No legal entity or company details are configured.</p>
        <p>Built for local demonstration. Live integrations remain disabled.</p>
      </div>
    </footer>
  );
}
