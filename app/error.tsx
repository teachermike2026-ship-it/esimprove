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
      <span className="badge badge-danger">Error</span>
      <h1>Something went wrong</h1>
      <p className="lead">
        The server could not complete that request. No payment was taken and no eSIM was
        activated as part of the failed step.
      </p>
      <div className="callout callout-warning">
        <AlertIcon className="inline-icon" />
        <p>
          Please try again. If the problem continues, contact support with the reference
          below.{error.digest ? ` Reference ${error.digest}` : ""}
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
