import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";
import { CookieSettingsButton } from "@/components/analytics-tracker";
export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("cookies");
}

export default async function CookiesPage() {
  return <LegalPage docKey="cookies"><div className="callout"><CookieSettingsButton /></div></LegalPage>;
}
export const dynamic = "force-dynamic";
