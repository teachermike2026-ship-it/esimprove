import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("terms");
}

export default async function TermsPage() {
  return <LegalPage docKey="terms"></LegalPage>;
}
