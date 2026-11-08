"use client";

type Point = { label: string; value: number };

export function LineChart({
  data,
  ariaLabel,
  height = 180,
  color = "#15803d",
}: {
  data: Point[];
  ariaLabel: string;
  height?: number;
  color?: string;
}) {
  const width = 640;
  const padding = { top: 12, right: 12, bottom: 26, left: 36 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((point) => point.value));
  const step = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth;
  const points = data.map((point, index) => ({
    x: padding.left + index * step,
    y: padding.top + innerHeight - (point.value / max) * innerHeight,
    ...point,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${padding.left},${padding.top + innerHeight} ${line} ${padding.left + (points.length - 1) * step},${padding.top + innerHeight}`
    : "";
  const ticks = [0, 0.5, 1].map((fraction) => ({
    y: padding.top + innerHeight - fraction * innerHeight,
    value: Math.round(max * fraction),
  }));

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{ariaLabel}</title>
        {ticks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
              stroke="currentColor"
              strokeOpacity="0.12"
            />
            <text x={4} y={tick.y + 4} fontSize="10" fill="currentColor" opacity="0.6">
              {tick.value}
            </text>
          </g>
        ))}
        {area ? <polygon points={area} fill={color} opacity="0.12" /> : null}
        {line ? <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" /> : null}
        {points.map((point) => (
          <circle key={point.x} cx={point.x} cy={point.y} r="3" fill={color}>
            <title>{`${point.label}: ${point.value}`}</title>
          </circle>
        ))}
        {points.length <= 12
          ? points.map((point, index) => (
              <text
                key={`label-${point.x}`}
                x={point.x}
                y={height - 6}
                fontSize="10"
                textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                fill="currentColor"
                opacity="0.65"
              >
                {shortDate(point.label)}
              </text>
            ))
          : null}
      </svg>
      <table className="visually-hidden">
        <caption>{ariaLabel}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Value</th></tr></thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}><td>{point.label}</td><td>{point.value}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shortDate(value: string): string {
  const parts = value.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return value;
}

export function BarList({
  rows,
  ariaLabel,
  emptyLabel = "No data for this period.",
}: {
  rows: { label: string; value: number; hint?: string; href?: string }[];
  ariaLabel: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) return <p className="muted small">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="bar-list" aria-label={ariaLabel}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="bar-list-head">
            <span className="bar-list-label">
              {row.href ? <a className="link" href={row.href}>{row.label}</a> : row.label}
            </span>
            <span className="bar-list-value">
              {row.value.toLocaleString()}
              {row.hint ? <span className="muted small"> · {row.hint}</span> : null}
            </span>
          </div>
          <div className="bar-track" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
