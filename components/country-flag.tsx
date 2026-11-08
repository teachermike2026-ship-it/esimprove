const FLAG_CODES = new Set([
  "AE",
  "AU",
  "BE",
  "BR",
  "AR",
  "CA",
  "CH",
  "CO",
  "CR",
  "DE",
  "EG",
  "ES",
  "FR",
  "GB",
  "GR",
  "HR",
  "IS",
  "IT",
  "JP",
  "KR",
  "MA",
  "MX",
  "NL",
  "NZ",
  "PE",
  "PT",
  "QA",
  "SG",
  "TH",
  "TN",
  "TR",
  "US",
  "VN",
  "ZA",
]);

function FlagArt({ code }: { code: string }) {
  switch (code) {
    case "FR":
      return (
        <>
          <rect width="8" height="16" fill="#1b3f8b" />
          <rect x="8" width="8" height="16" fill="#fff" />
          <rect x="16" width="8" height="16" fill="#e1444f" />
        </>
      );
    case "IT":
      return (
        <>
          <rect width="8" height="16" fill="#269447" />
          <rect x="8" width="8" height="16" fill="#fff" />
          <rect x="16" width="8" height="16" fill="#d94a4a" />
        </>
      );
    case "BE":
      return (
        <>
          <rect width="8" height="16" fill="#202124" />
          <rect x="8" width="8" height="16" fill="#f4cf45" />
          <rect x="16" width="8" height="16" fill="#d94a4a" />
        </>
      );
    case "ES":
      return (
        <>
          <rect width="24" height="16" fill="#c73b3b" />
          <rect y="4" width="24" height="8" fill="#f4cf45" />
        </>
      );
    case "EG":
      return (
        <>
          <rect width="24" height="5.3" fill="#c73b3b" />
          <rect y="5.3" width="24" height="5.4" fill="#fff" />
          <rect y="10.7" width="24" height="5.3" fill="#202124" />
        </>
      );
    case "MA":
      return (
        <>
          <rect width="24" height="16" fill="#c73b3b" />
          <path
            d="M12 5.2l1.3 3.9h4.1l-3.3 2.4 1.2 3.9-3.3-2.4-3.3 2.4 1.2-3.9L6.6 9.1h4.1z"
            fill="none"
            stroke="#1d7b45"
            strokeWidth="0.9"
          />
        </>
      );
    case "TN":
      return (
        <>
          <rect width="24" height="16" fill="#c73b3b" />
          <circle cx="12" cy="8" r="4.2" fill="#fff" />
          <circle cx="12" cy="8" r="2.6" fill="#c73b3b" />
          <circle cx="13.2" cy="7.2" r="2.1" fill="#fff" />
        </>
      );
    case "TR":
      return (
        <>
          <rect width="24" height="16" fill="#c73b3b" />
          <circle cx="10.5" cy="8" r="3.6" fill="#fff" />
          <circle cx="12" cy="8" r="2.8" fill="#c73b3b" />
          <path d="M17 5.8l.6 1.8h1.9l-1.5 1.1.6 1.8-1.6-1.1-1.6 1.1.6-1.8-1.5-1.1h1.9z" fill="#fff" />
        </>
      );
    case "AE":
      return (
        <>
          <rect width="6" height="16" fill="#c73b3b" />
          <rect x="6" width="18" height="5.3" fill="#269447" />
          <rect x="6" y="5.3" width="18" height="5.4" fill="#fff" />
          <rect x="6" y="10.7" width="18" height="5.3" fill="#202124" />
        </>
      );
    case "GB":
      return (
        <>
          <rect width="24" height="16" fill="#1b3f8b" />
          <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="3" />
          <path d="M0 0l24 16M24 0L0 16" stroke="#c73b3b" strokeWidth="1.3" />
          <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
          <path d="M12 0v16M0 8h24" stroke="#c73b3b" strokeWidth="2.6" />
        </>
      );
    case "US":
      return (
        <>
          <rect width="24" height="16" fill="#fff" />
          {[0, 3.2, 6.4, 9.6, 12.8].map((y) => (
            <rect key={y} y={y} width="24" height="1.6" fill="#c73b3b" />
          ))}
          <rect width="10" height="8" fill="#1b3f8b" />
          {[1.4, 3.8, 6.2].map((y) =>
            [1.6, 4.4, 7.2].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.45" fill="#fff" />),
          )}
        </>
      );
    case "JP":
      return (
        <>
          <rect width="24" height="16" fill="#fff" />
          <circle cx="12" cy="8" r="4.2" fill="#c73b3b" />
        </>
      );
    case "TH":
      return (
        <>
          <rect width="24" height="16" fill="#c73b3b" />
          <rect y="4" width="24" height="8" fill="#fff" />
          <rect y="6" width="24" height="4" fill="#1b3f8b" />
        </>
      );
    case "KR":
      return (
        <>
          <rect width="24" height="16" fill="#fff" />
          <circle cx="12" cy="8" r="4" fill="#c73b3b" />
          <path d="M8 8a4 4 0 004 4 4 4 0 01-4-4z" fill="#1b3f8b" />
          <path d="M4 3l3 1M20 13l-3-1M4 13l3-1M20 3l-3 1" stroke="#202124" strokeWidth="1" />
        </>
      );
    case "SG":
      return (
        <>
          <rect width="24" height="8" fill="#c73b3b" />
          <rect y="8" width="24" height="8" fill="#fff" />
          <circle cx="8" cy="4" r="2.3" fill="#fff" />
          <circle cx="9" cy="4" r="2" fill="#c73b3b" />
          {[3.5, 5.5, 7.5].map((x) => (
            <circle key={x} cx={x} cy="3" r="0.5" fill="#fff" />
          ))}
        </>
      );
    case "AU":
      return (
        <>
          <rect width="24" height="16" fill="#1b3f8b" />
          <path d="M0 0l12 8M12 0L0 8" stroke="#fff" strokeWidth="1.6" />
          <path d="M6 0v8M0 4h12" stroke="#fff" strokeWidth="2.4" />
          <path d="M6 0v8M0 4h12" stroke="#c73b3b" strokeWidth="1.2" />
          {[16, 20, 18].map((x, i) => (
            <circle key={x} cx={x} cy={4 + i * 3} r="0.9" fill="#fff" />
          ))}
        </>
      );
    case "CH":
      return (
        <>
          <rect width="24" height="16" fill="#d94a4a" />
          <rect x="10" y="3.5" width="4" height="9" fill="#fff" />
          <rect x="7.5" y="6" width="9" height="4" fill="#fff" />
        </>
      );
    case "GR":
      return (
        <>
          <rect width="24" height="16" fill="#1b3f8b" />
          <rect y="2" width="24" height="2" fill="#fff" />
          <rect y="6" width="24" height="2" fill="#fff" />
          <rect y="10" width="24" height="2" fill="#fff" />
          <rect y="14" width="24" height="2" fill="#fff" />
          <rect width="9" height="9" fill="#1b3f8b" />
          <rect x="3.5" y="0" width="2" height="9" fill="#fff" />
          <rect x="0" y="3.5" width="9" height="2" fill="#fff" />
        </>
      );
    case "PT":
      return (
        <>
          <rect width="24" height="16" fill="#269447" />
          <rect width="9" height="16" fill="#c73b3b" />
          <circle cx="9" cy="8" r="3.2" fill="#f4cf45" />
        </>
      );
    case "DE":
      return (
        <>
          <rect width="24" height="5.3" fill="#202124" />
          <rect y="5.3" width="24" height="5.4" fill="#c73b3b" />
          <rect y="10.7" width="24" height="5.3" fill="#f4cf45" />
        </>
      );
    case "NL":
      return (
        <>
          <rect width="24" height="5.3" fill="#c73b3b" />
          <rect y="5.3" width="24" height="5.4" fill="#fff" />
          <rect y="10.7" width="24" height="5.3" fill="#1b3f8b" />
        </>
      );
    case "CA":
      return (
        <>
          <rect width="24" height="16" fill="#fff" />
          <rect width="6" height="16" fill="#c73b3b" />
          <rect x="18" width="6" height="16" fill="#c73b3b" />
          <path d="M12 3.5l1 3 2.5-1.3-.8 3.1 2.2 1.4-3 1.4.3 2.4-2.2-1.6-2.2 1.6.3-2.4-3-1.4 2.2-1.4-.8-3.1 2.5 1.3z" fill="#c73b3b" />
        </>
      );
    case "MX":
      return (
        <>
          <rect width="8" height="16" fill="#269447" />
          <rect x="8" width="8" height="16" fill="#fff" />
          <rect x="16" width="8" height="16" fill="#c73b3b" />
          <circle cx="12" cy="8" r="2" fill="#c73b3b" />
        </>
      );
    case "ZA":
      return (
        <>
          <rect width="24" height="16" fill="#269447" />
          <path d="M0 0l10 8-10 8z" fill="#202124" />
          <path d="M0 5l12 3-12 3z" fill="#f4cf45" />
          <rect y="7" width="24" height="2" fill="#fff" />
          <rect y="0" width="24" height="2" fill="#c73b3b" />
          <rect y="14" width="24" height="2" fill="#1b3f8b" />
        </>
      );
    case "IS":
      return (
        <>
          <rect width="24" height="16" fill="#1b4f9e" />
          <rect x="7" width="4" height="16" fill="#fff" />
          <rect y="6" width="24" height="4" fill="#fff" />
          <rect x="8" width="2" height="16" fill="#c73b3b" />
          <rect y="7" width="24" height="2" fill="#c73b3b" />
        </>
      );
    case "HR":
      return (
        <>
          <rect width="24" height="5.3" fill="#c73b3b" />
          <rect y="5.3" width="24" height="5.4" fill="#fff" />
          <rect y="10.7" width="24" height="5.3" fill="#1b3f8b" />
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={9 + col * 2}
                y={5.5 + row * 2}
                width="2"
                height="2"
                fill={(row + col) % 2 === 0 ? "#c73b3b" : "#fff"}
                stroke="#c73b3b"
                strokeWidth="0.25"
              />
            )),
          )}
        </>
      );
    case "CR":
      return (
        <>
          <rect width="24" height="16" fill="#1b4f9e" />
          <rect y="3.2" width="24" height="9.6" fill="#fff" />
          <rect y="5.6" width="24" height="4.8" fill="#c73b3b" />
        </>
      );
    case "VN":
      return (
        <>
          <rect width="24" height="16" fill="#c73b3b" />
          <path d="M12 4.6l1.2 3.6h3.8l-3.1 2.3 1.2 3.6-3.1-2.2-3.1 2.2 1.2-3.6-3.1-2.3h3.8z" fill="#f4cf45" />
        </>
      );
    case "QA":
      return (
        <>
          <rect width="24" height="16" fill="#fff" />
          <rect x="6" width="18" height="16" fill="#7c2138" />
          <path d="M6 0l2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2z" fill="#fff" />
        </>
      );
    case "BR":
      return (
        <>
          <rect width="24" height="16" fill="#269447" />
          <path d="M12 2.5 21.5 8 12 13.5 2.5 8z" fill="#f4cf45" />
          <circle cx="12" cy="8" r="3.1" fill="#1b3f8b" />
          <path d="M9.2 7.4c1.7-.8 3.9-.7 5.7.3" stroke="#fff" strokeWidth="0.7" fill="none" />
        </>
      );
    case "AR":
      return (
        <>
          <rect width="24" height="16" fill="#74a9db" />
          <rect y="5.3" width="24" height="5.4" fill="#fff" />
          <circle cx="12" cy="8" r="1.9" fill="#f4cf45" />
        </>
      );
    case "CO":
      return (
        <>
          <rect width="24" height="8" fill="#f4cf45" />
          <rect y="8" width="24" height="5" fill="#1b3f8b" />
          <rect y="13" width="24" height="3" fill="#c73b3b" />
        </>
      );
    case "PE":
      return (
        <>
          <rect width="24" height="16" fill="#c73b3b" />
          <rect x="8" width="8" height="16" fill="#fff" />
        </>
      );
    default:
      return <rect width="24" height="16" fill="#edf8ec" />;
  }
}

export function CountryFlag({ code, label }: { code: string; label: string }) {
  const normalized = code.toUpperCase();
  if (!FLAG_CODES.has(normalized)) {
    return (
      <span className="es-flag es-flag-fallback" aria-hidden="true">
        {normalized}
      </span>
    );
  }

  return (
    <span className="es-flag" aria-hidden="true" title={label}>
      <svg viewBox="0 0 24 16" role="presentation" focusable="false">
        <FlagArt code={normalized} />
      </svg>
    </span>
  );
}
