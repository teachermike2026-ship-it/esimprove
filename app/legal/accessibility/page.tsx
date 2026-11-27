import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("accessibility");
}

export default async function AccessibilityPage() {
  return <LegalPage docKey="accessibility"></LegalPage>;
}
