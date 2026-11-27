"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the server page while a payment is pending, so a customer who
 * returns from Whop's hosted checkout sees the result once the signed webhook
 * has been processed. It only re-reads server state; it never changes it.
 */
export function PaymentStatusRefresher({
  intervalMs = 5000,
  maxAttempts = 36,
}: {
  intervalMs?: number;
  maxAttempts?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts > maxAttempts) {
        window.clearInterval(timer);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs, maxAttempts]);
  return null;
}
