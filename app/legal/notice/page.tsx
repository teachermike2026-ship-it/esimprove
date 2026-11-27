import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("notice");
}

export default async function LegalNoticePage() {
  return <LegalPage docKey="notice"></LegalPage>;
}
