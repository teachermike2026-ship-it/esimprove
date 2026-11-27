import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";
import { PrivacyContact } from "@/components/legal-document";
export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("privacy");
}

export default async function PrivacyPage() {
  return <LegalPage docKey="privacy"><PrivacyContact /></LegalPage>;
}
export const dynamic = "force-dynamic";
