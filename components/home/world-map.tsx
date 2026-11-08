export function WorldMap({
  className = "",
  patternId = "es-map-dots",
}: {
  className?: string;
  patternId?: string;
}) {
  return (
    <svg
      className={`es-world-map ${className}`.trim()}
      viewBox="0 0 800 520"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.8" cy="1.8" r="1.35" fill="currentColor" />
        </pattern>
      </defs>

      <path d="M360 138C446 52 602 58 696 136" className="es-map-route" />
      <path d="M214 170C344 82 512 80 646 126" className="es-map-route es-map-route-soft" />
      <path d="M468 324C556 280 646 302 706 356" className="es-map-route es-map-route-soft" />

      <g className="es-map-land" fill={`url(#${patternId})`}>
        <path d="M58 96 120 70l70 6 42 24 14 28-24 18-8 28-30 10-14 26-26 12-16-24-24-14-22-30-26-24z" />
        <path d="m180 225 26-5 10 18-16 10-14-8z" />
        <path d="m218 268 34-12 22 26-8 40-22 44-13 38-15-28-8-40 4-36z" />
        <path d="m382 94 36-12 38 10 18 20-16 20-28 12-22-10-18-18z" />
        <path d="m366 100 10-8 4 14-10 6z" />
        <path d="m414 172 48-10 30 24 6 38-16 44-22 38-20 28-16-30-10-36-10-38-2-34z" />
        <path d="m480 82 72-16 74 12 66 28 20 34-24 24-38 12-30 28-36 10-26-16-28-24-32-10-16-28z" />
        <path d="m584 220 26-10 14 24-10 30-18 18-8-30z" />
        <path d="m634 230 28-6 16 18-12 20-20-4z" />
        <path d="m680 330 50-12 32 22-12 34-36 12-28-20z" />
        <path d="m777 390 13-10 4 18-12 14z" />
        <path d="m704 190 10-8 4 16-10 8z" />
        <path d="m525 244 12 6-4 14-12-4z" />
      </g>

      <g className="es-map-pins">
        <circle cx="374" cy="112" r="4.5" />
        <circle cx="456" cy="330" r="4.5" />
        <circle cx="640" cy="252" r="4.5" />
        <circle cx="712" cy="346" r="4.5" />
        <circle cx="208" cy="124" r="4.5" />
      </g>
    </svg>
  );
}
