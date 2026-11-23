import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <span className="badge badge-neutral">404</span>
      <h1>That page doesn’t exist</h1>
      <p className="lead">
        The page you’re looking for may have moved, or the link is out of date.
      </p>
      <div className="hero-actions">
        <Link className="button" href="/">
          Go home
        </Link>
        <Link className="button button-secondary" href="/plans">
          Browse plans
        </Link>
      </div>
    </div>
  );
}
