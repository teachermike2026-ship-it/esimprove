import Link from "next/link";

/** Official ESIMPROVE "e" mark (green-to-blue gradient), served as a static SVG. */
export const BRAND_MARK_SRC = "/brand/esimprove-mark.svg";

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
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed */}
        <img src={BRAND_MARK_SRC} alt="" width={38} height={38} decoding="async" />
      </span>
      <span className="es-brand-word">
        Esim<span>prove</span>
      </span>
    </Link>
  );
}
