import Link from "next/link";

const links = [
  { href: "/legal/terms", label: "Demo terms" },
  { href: "/legal/privacy", label: "Privacy draft" },
  { href: "/legal/refunds", label: "Refund draft" },
  { href: "/legal/cookies", label: "Cookies" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="pill-row section-tight" aria-label="Legal documents">
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
