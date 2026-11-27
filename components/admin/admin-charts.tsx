"use client";

import { useState } from "react";

/** Revenue (left axis, USD) and orders (right axis) per day, with hover tooltips. */
export function RevenueOrdersChart({
  points,
  series = "both",
}: {
  points: Array<{ day: string; revenue: number; orders: number }>;
  series?: "both" | "revenue" | "orders";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const height = 260;
  const pad = { top: 16, right: 44, bottom: 34, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxRevenue = niceMax(Math.max(1, ...points.map((p) => p.revenue)));
  const maxOrders = niceMax(Math.max(1, ...points.map((p) => p.orders)));
  const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yR = (v: number) => pad.top + innerH - (v / maxRevenue) * innerH;
  const yO = (v: number) => pad.top + innerH - (v / maxOrders) * innerH;
  const line = (fn: (p: (typeof points)[number]) => number) => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${fn(p)}`).join(" ");
  const area = (fn: (p: (typeof points)[number]) => number) =>
    points.length > 0 ? `${line(fn)} L${x(points.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z` : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const showRevenue = series !== "orders";
  const showOrders = series !== "revenue";
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="ac-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue and orders per day" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ac-rev" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="ac-ord" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH * (1 - t)} y2={pad.top + innerH * (1 - t)} className="ac-grid" />
            {showRevenue ? (
              <text x={pad.left - 8} y={pad.top + innerH * (1 - t) + 4} textAnchor="end" className="ac-axis">
                ${Math.round(maxRevenue * t)}
              </text>
            ) : null}
            {showOrders ? (
              <text x={width - pad.right + 8} y={pad.top + innerH * (1 - t) + 4} className="ac-axis">
                {Math.round(maxOrders * t)}
              </text>
            ) : null}
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.day} x={x(i)} y={height - 10} textAnchor="middle" className="ac-axis">
              {shortDay(p.day)}
            </text>
          ) : null,
        )}
        {showRevenue ? (
          <>
            <path d={area((p) => yR(p.revenue))} fill="url(#ac-rev)" />
            <path d={line((p) => yR(p.revenue))} className="ac-line ac-line-revenue" />
          </>
        ) : null}
        {showOrders ? (
          <>
            {series === "orders" ? <path d={area((p) => yO(p.orders))} fill="url(#ac-ord)" /> : null}
            <path d={line((p) => yO(p.orders))} className="ac-line ac-line-orders" />
          </>
        ) : null}
        {points.map((p, i) => (
          <g key={p.day}>
            {showRevenue ? <circle cx={x(i)} cy={yR(p.revenue)} r={hover === i ? 5 : 3.5} className="ac-dot ac-dot-revenue" /> : null}
            {showOrders ? <circle cx={x(i)} cy={yO(p.orders)} r={hover === i ? 5 : 3.5} className="ac-dot ac-dot-orders" /> : null}
            <rect
              x={x(i) - innerW / Math.max(1, points.length) / 2}
              y={pad.top}
              width={innerW / Math.max(1, points.length)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${p.day}: $${p.revenue.toFixed(2)}, ${p.orders} orders`}
            />
          </g>
        ))}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="ac-hover-line" /> : null}
      </svg>
      {active ? (
        <div className="ac-tooltip" style={{ left: `${(x(hover!) / width) * 100}%` }}>
          <strong>{active.day}</strong>
          <span>
            <i className="ac-key ac-key-revenue" /> Revenue ${active.revenue.toFixed(2)}
          </span>
          <span>
            <i className="ac-key ac-key-orders" /> Orders {active.orders}
          </span>
        </div>
      ) : null}
      <div className="ac-legend">
        {showRevenue ? (
          <span>
            <i className="ac-key ac-key-revenue" /> Revenue (USD)
          </span>
        ) : null}
        {showOrders ? (
          <span>
            <i className="ac-key ac-key-orders" /> Orders
          </span>
        ) : null}
      </div>
    </div>
  );
}

function niceMax(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) if (value <= step * magnitude) return step * magnitude;
  return 10 * magnitude;
}

function shortDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Donut chart for order status. */
export function StatusDonut({
  segments,
  total,
  label,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
  label: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="ac-donut" role="img" aria-label={`${total} ${label}`}>
      <circle cx="70" cy="70" r={radius} className="ac-donut-track" />
      {total > 0
        ? segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const length = (s.value / total) * circumference;
              const el = (
                <circle
                  key={s.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="18"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              );
              offset += length;
              return el;
            })
        : null}
      <text x="70" y="68" textAnchor="middle" className="ac-donut-value">
        {total}
      </text>
      <text x="70" y="88" textAnchor="middle" className="ac-donut-label">
        {label}
      </text>
    </svg>
  );
}

/** Tapered funnel graphic; widths follow the stage counts. */
export function FunnelGraphic({ stages }: { stages: Array<{ label: string; value: number | null }> }) {
  const colors = ["#38bdf8", "#2563eb", "#4f46e5", "#7c6cf0", "#22a3d6", "#16a34a"];
  const max = Math.max(1, ...stages.map((s) => s.value ?? 0));
  const h = 30;
  const gap = 6;
  const width = 140;
  return (
    <svg viewBox={`0 0 ${width} ${stages.length * (h + gap)}`} className="ac-funnel" role="img" aria-label="Sales funnel">
      {stages.map((s, i) => {
        const top = Math.max(0.18, (s.value ?? 0) / max);
        const next = Math.max(0.12, (stages[i + 1]?.value ?? s.value ?? 0) / max);
        const w1 = width * Math.min(1, Math.max(top, 0.2));
        const w2 = width * Math.min(1, Math.max(Math.min(next, top), 0.14));
        const y = i * (h + gap);
        const points = `${(width - w1) / 2},${y} ${(width + w1) / 2},${y} ${(width + w2) / 2},${y + h} ${(width - w2) / 2},${y + h}`;
        return (
          <polygon key={s.label} points={points} fill={colors[i % colors.length]} opacity={s.value === null ? 0.25 : 1}>
            <title>{`${s.label}: ${s.value ?? "data unavailable"}`}</title>
          </polygon>
        );
      })}
    </svg>
  );
}
