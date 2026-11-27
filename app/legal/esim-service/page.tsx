import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("esim");
}

export default async function EsimServicePage() {
  return <LegalPage docKey="esim"></LegalPage>;
}
