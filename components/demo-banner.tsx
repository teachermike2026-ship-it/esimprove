import Link from "next/link";
import { demoMode } from "@/lib/config";
import { sitePromo } from "@/lib/site-content";

export function DemoBanner() {
  if (sitePromo.enabled) {
    return (
      <div className="es-announcement" aria-label="Offer announcement">
        <div className="es-shell es-announcement-inner">
          <span className="es-announcement-spark" aria-hidden="true">
            ✦
          </span>
          <p>
            <strong>{sitePromo.text}</strong>
            {demoMode ? (
              <span className="es-announcement-demo"> · Demo build — no live orders.</span>
            ) : null}
          </p>
          <Link className="es-announcement-link" href={sitePromo.href}>
            Shop plans
          </Link>
        </div>
      </div>
    );
  }

  if (demoMode) {
    return (
      <div className="es-announcement" aria-label="Demo notice">
        <div className="es-shell es-announcement-inner">
          <span className="es-announcement-spark" aria-hidden="true">
            ✦
          </span>
          <p>
            <strong>Demo build.</strong>{" "}
            <span className="es-announcement-full">
              Catalogue, prices, and activation are illustrative — no live payments or eSIMs.
            </span>
            <span className="es-announcement-short">No live payments or eSIMs.</span>
          </p>
          <Link className="es-announcement-link" href="/#demo-limits">
            Demo limits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="es-announcement" aria-label="Site announcement">
      <div className="es-shell es-announcement-inner">
        <span className="es-announcement-spark" aria-hidden="true">
          ✦
        </span>
        <p>Travel eSIM plans for your next trip — compare data, validity, and price.</p>
        <Link className="es-announcement-link" href="/plans">
          Compare plans
        </Link>
      </div>
    </div>
  );
}
