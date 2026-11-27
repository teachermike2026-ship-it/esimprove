import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("payments");
}

export default async function PaymentsPage() {
  return <LegalPage docKey="payments"></LegalPage>;
}
