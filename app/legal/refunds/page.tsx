import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("refunds");
}

export default async function RefundsPage() {
  return <LegalPage docKey="refunds"></LegalPage>;
}
