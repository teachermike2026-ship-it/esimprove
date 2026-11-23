import type { Metadata } from "next";
import Link from "next/link";
import { CompatibilityChecker } from "@/components/compatibility-checker";
import { ArrowRight, QrIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Compatibility checker",
  description:
    "A device compatibility guide for eSIM. Verify support with the manufacturer before buying.",
  alternates: { canonical: "/compatibility" },
};

export default function CompatibilityPage() {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Device check</p>
          <h1>Is your phone eSIM-ready?</h1>
          <p className="lead">
            Use this checker as a starting point. The reliable answer comes from the device
            itself and the manufacturer&apos;s documentation.
          </p>
        </div>
      </div>
      <CompatibilityChecker />
      <section className="section" aria-labelledby="compat-more">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Next steps</p>
            <h2 id="compat-more">Check, then install</h2>
          </div>
        </div>
        <div className="grid grid-3">
          <article className="card form">
            <h3>
              <QrIcon className="inline-icon" /> Look in settings
            </h3>
            <p className="muted small">
              Search the device settings for “Add eSIM”, “Add mobile plan”, or “SIM manager”.
              If the option is absent, the device may not support eSIM.
            </p>
          </article>
          <article className="card form">
            <h3>Carrier-unlocked</h3>
            <p className="muted small">
              A carrier lock can prevent another provider&apos;s eSIM from working. Confirm
              the device is unlocked before purchasing any real plan.
            </p>
          </article>
          <article className="card form">
            <h3>Read the guide</h3>
            <p className="muted small">
              Installation differs between iOS and Android. The general guides explain the
              expected steps and common failure points.
            </p>
            <Link className="button button-ghost button-small" href="/guides">
              Install guides <ArrowRight className="inline-icon" />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
