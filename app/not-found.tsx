import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <span className="badge badge-demo">404</span>
      <h1>That page is not in the demo catalogue</h1>
      <p className="lead">
        The destination, plan, guide, or order you requested does not exist in this local
        build.
      </p>
      <div className="hero-actions">
        <Link className="button" href="/">
          Go home
        </Link>
        <Link className="button button-secondary" href="/plans">
          Browse demo plans
        </Link>
      </div>
    </div>
  );
}
