"use client";

import Link from "next/link";
import { AlertIcon, RetryIcon } from "@/components/icons";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="not-found">
      <span className="badge badge-danger">Demo error</span>
      <h1>Something went wrong locally</h1>
      <p className="lead">
        The demo server could not complete that request. No real payment, supplier order, or
        email was involved.
      </p>
      <div className="callout callout-warning">
        <AlertIcon className="inline-icon" />
        <p>
          {error.message || "Unknown error"}
          {error.digest ? ` · reference ${error.digest}` : ""}
        </p>
      </div>
      <div className="hero-actions">
        <button className="button" type="button" onClick={reset}>
          <RetryIcon className="inline-icon" /> Try again
        </button>
        <Link className="button button-secondary" href="/">
          Go home
        </Link>
      </div>
    </div>
  );
}
