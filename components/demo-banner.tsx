import Link from "next/link";
import { demoMode } from "@/lib/config";
import { AlertIcon } from "@/components/icons";

export function DemoBanner() {
  if (!demoMode) return null;
  return (
    <div className="demo-banner" role="status">
      <div className="container demo-banner-inner">
        <AlertIcon className="demo-banner-icon" />
        <p>
          <strong>Demo environment.</strong> Catalogue, prices, coverage, and activation data
          are illustrative. Payments are simulated, no real eSIM is provisioned, and no email
          is sent.
        </p>
        <Link href="/#demo-limits">What this means</Link>
      </div>
    </div>
  );
}
