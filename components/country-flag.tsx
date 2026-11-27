import { GlobeIcon } from "@/components/icons";
import { flagScope, flagSrc, hasFlag } from "@/lib/flags";

/**
 * A national flag for one ISO 3166-1 alpha-2 code. The image is decorative:
 * every caller shows the country name next to it, so it is hidden from
 * assistive technology and only carries a tooltip.
 */
export function CountryFlag({ code, label, eager }: { code: string; label?: string; eager?: boolean }) {
  const normalized = code.trim().toUpperCase();
  if (!hasFlag(normalized)) {
    return (
      <span className="es-flag es-flag-fallback" aria-hidden="true" title={label}>
        {normalized.slice(0, 3)}
      </span>
    );
  }
  return (
    <span className="es-flag" aria-hidden="true" title={label}>
      {/* Static SVG flags from /public/flags: next/image adds nothing for these tiny vectors. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={flagSrc(normalized)} alt="" width={32} height={24} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />
    </span>
  );
}

/**
 * The flag treatment for any destination or plan, from catalog data only:
 * one national flag for a single-country destination, the flags of the
 * countries actually covered for a regional package (first `max`, then "+N"),
 * and a globe for global packages.
 */
export function DestinationFlag({
  countryCode,
  name,
  coverage = [],
  max = 3,
  size = "md",
  eager,
}: {
  countryCode: string;
  name: string;
  coverage?: readonly string[];
  max?: number;
  size?: "sm" | "md" | "lg";
  /** Load immediately (above-the-fold placements such as a page hero). */
  eager?: boolean;
}) {
  const scope = flagScope(countryCode, coverage);
  const sizeClass = `es-flagset es-flagset-${size}`;
  if (scope.kind === "country") {
    return (
      <span className={sizeClass}>
        <CountryFlag code={scope.code} label={name} eager={eager} />
      </span>
    );
  }
  if (scope.kind === "global" || scope.codes.length === 0) {
    return (
      <span className={`${sizeClass} es-flagset-global`} aria-hidden="true" title={name}>
        <span className="es-flag es-flag-globe">
          <GlobeIcon />
        </span>
      </span>
    );
  }
  const shown = scope.codes.slice(0, max);
  const more = scope.codes.length - shown.length;
  return (
    <span className={`${sizeClass} es-flagset-region`} aria-hidden="true" title={name}>
      {shown.map((code) => (
        <CountryFlag key={code} code={code} eager={eager} />
      ))}
      {more > 0 ? <span className="es-flag es-flag-more">+{more}</span> : null}
    </span>
  );
}
