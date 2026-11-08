import Link from "next/link";

const links = [
  { href: "/legal/privacy", label: "Privacy policy" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/legal/refunds", label: "Refund policy" },
  { href: "/legal/cookies", label: "Cookie policy" },
  { href: "/legal/accessibility", label: "Accessibility" },
  { href: "/privacy/request", label: "Privacy request" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="pill-row section-tight" aria-label="Legal documents and privacy requests">
        {links.map((link) => (
          <Link key={link.href} className="badge badge-neutral" href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
