import Link from "next/link";

export function BrandMark({
  href = "/",
  light = false,
  ariaLabel = "Esimprove home",
}: {
  href?: string;
  light?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Link className={`es-brand${light ? " es-brand-light" : ""}`} href={href} aria-label={ariaLabel}>
      <span className="es-brand-mark" aria-hidden="true">
        <span className="es-brand-letter">e</span>
        <span className="es-brand-orbit" />
      </span>
      <span className="es-brand-word">
        Esim<span>prove</span>
      </span>
    </Link>
  );
}
