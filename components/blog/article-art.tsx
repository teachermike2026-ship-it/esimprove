/**
 * Original editorial illustrations for blog articles, drawn in the ESIMPROVE
 * palette. Pure SVG (no external images, no licensing questions), so it is
 * used both inline on cards (no layout shift, no extra request) and inside
 * the PNG Open Graph image route (next/og renders SVG children).
 *
 * Keep to plain shapes, and build the tree with function *calls* (not
 * nested components): Satori only accepts intrinsic elements inside <svg>.
 */
import type { ArtTheme } from "@/lib/editorial/types";

const NAVY = "#11182c";
const GREEN = "#22b45f";
const GREEN_DARK = "#178a4a";
const GREEN_SOFT = "#e7f6ee";
const CREAM = "#eef4ff";
const YELLOW = "#9cc0ff";
const WHITE = "#ffffff";

function star(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(" ");
}

/** Signal arcs in the top-right corner: the shared brand motif. */
function signal(x: number, y: number, color: string) {
  return (
    <g>
      <circle cx={x} cy={y} r={4} fill={color} />
      <path d={`M ${x - 10} ${y - 10} A 14 14 0 0 1 ${x + 10} ${y - 10}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={`M ${x - 18} ${y - 17} A 25 25 0 0 1 ${x + 18} ${y - 17}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.75} />
      <path d={`M ${x - 26} ${y - 24} A 36 36 0 0 1 ${x + 26} ${y - 24}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.5} />
    </g>
  );
}

function dots(color: string) {
  const items = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      items.push(<circle key={`${row}-${col}`} cx={16 + col * 12} cy={16 + row * 12} r={1.4} fill={color} opacity={0.35} />);
    }
  }
  return <g>{items}</g>;
}

function scene(theme: ArtTheme) {
  switch (theme) {
    case "japan":
      return (
        <g>
          <rect width={320} height={180} fill={CREAM} />
          {dots(NAVY)}
          <circle cx={170} cy={86} r={44} fill="#d94f45" />
          <polygon points="0,180 70,104 112,140 168,82 232,150 268,120 320,160 320,180" fill={NAVY} />
          <polygon points="148,104 168,82 188,104 176,100 168,108 160,100" fill={WHITE} />
          <polygon points="0,180 60,140 120,168 190,132 260,170 320,150 320,180" fill={GREEN_DARK} opacity={0.9} />
          {signal(282, 48, NAVY)}
        </g>
      );
    case "europe":
      return (
        <g>
          <rect width={320} height={180} fill={NAVY} />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 12;
            return <polygon key={i} points={star(118 + 52 * Math.cos(angle), 92 + 52 * Math.sin(angle), 7)} fill={YELLOW} />;
          })}
          <path d="M 190 140 C 210 100, 240 120, 250 80 S 290 60, 300 40" stroke={GREEN} strokeWidth={4} fill="none" strokeDasharray="2 8" strokeLinecap="round" />
          <circle cx={190} cy={140} r={6} fill={GREEN} />
          <circle cx={250} cy={80} r={6} fill={GREEN} />
          <circle cx={300} cy={40} r={6} fill={GREEN} />
          {signal(40, 160, GREEN)}
        </g>
      );
    case "vietnam":
      return (
        <g>
          <rect width={320} height={180} fill={GREEN_SOFT} />
          {dots(GREEN_DARK)}
          <path d="M 40 140 C 40 80, 62 60, 74 62 C 86 64, 92 100, 96 140 Z" fill={GREEN_DARK} />
          <path d="M 96 140 C 100 70, 128 40, 142 42 C 160 46, 166 96, 170 140 Z" fill={NAVY} />
          <path d="M 170 140 C 176 96, 196 78, 208 80 C 222 84, 228 112, 230 140 Z" fill={GREEN} />
          <rect y={140} width={320} height={40} fill="#cfe9d1" />
          <path d="M 20 152 H 120 M 150 160 H 260 M 60 170 H 190" stroke={WHITE} strokeWidth={3} strokeLinecap="round" />
          <path d="M 236 150 L 262 150 L 256 158 L 242 158 Z" fill={NAVY} />
          {signal(282, 56, GREEN_DARK)}
        </g>
      );
    case "thailand":
      return (
        <g>
          <rect width={320} height={180} fill="#ffe8c7" />
          <circle cx={250} cy={60} r={26} fill={YELLOW} />
          <polygon points="110,50 122,70 98,70" fill={NAVY} />
          <polygon points="110,62 138,96 82,96" fill={GREEN_DARK} />
          <polygon points="110,82 158,126 62,126" fill={NAVY} />
          <rect x={78} y={126} width={64} height={22} fill={GREEN_DARK} />
          <rect x={104} y={132} width={12} height={16} fill={YELLOW} />
          <rect y={148} width={320} height={32} fill="#3aa6b9" />
          <path d="M 20 160 H 90 M 170 166 H 300 M 120 172 H 210" stroke={WHITE} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
          {signal(44, 48, NAVY)}
        </g>
      );
    case "usa":
      return (
        <g>
          <rect width={320} height={180} fill={NAVY} />
          {[[30, 30], [70, 18], [120, 36], [200, 22], [240, 40], [290, 16]].map(([x, y], i) => (
            <polygon key={i} points={star(x!, y!, 4)} fill={YELLOW} />
          ))}
          <polygon points="0,120 60,70 110,110 170,56 230,104 280,76 320,100 320,180 0,180" fill="#2b3554" />
          <polygon points="150,180 170,104 178,104 230,180" fill="#4a5578" />
          <polygon points="0,180 0,150 320,150 320,180" fill={GREEN_DARK} opacity={0.85} />
          <polygon points="140,180 172,110 176,110 240,180" fill="#3b4566" />
          <path d="M 174 116 L 174 124 M 174 134 L 174 146 M 174 156 L 174 174" stroke={YELLOW} strokeWidth={3} />
          {signal(282, 70, GREEN)}
        </g>
      );
    case "turkey":
      return (
        <g>
          <rect width={320} height={180} fill="#ffe1d2" />
          <circle cx={84} cy={56} r={22} fill="#d94f45" />
          <rect x={78} y={84} width={12} height={9} fill={NAVY} />
          <path d="M 64 62 L 80 84 M 104 62 L 88 84" stroke={NAVY} strokeWidth={1.5} />
          <circle cx={168} cy={40} r={15} fill={GREEN} />
          <rect x={164} y={59} width={8} height={6} fill={NAVY} />
          <circle cx={228} cy={70} r={18} fill={YELLOW} />
          <rect x={223} y={92} width={10} height={7} fill={NAVY} />
          <polygon points="0,180 30,120 48,132 70,96 96,140 124,110 150,150 190,104 222,146 260,118 290,150 320,126 320,180" fill="#c98a5e" />
          <polygon points="0,180 0,160 320,160 320,180" fill={NAVY} />
          {signal(288, 48, NAVY)}
        </g>
      );
    case "data":
      return (
        <g>
          <rect width={320} height={180} fill={CREAM} />
          {dots(NAVY)}
          <rect x={120} y={18} width={80} height={146} rx={14} fill={NAVY} />
          <rect x={128} y={30} width={64} height={122} rx={6} fill={WHITE} />
          <path d="M 138 92 A 22 22 0 0 1 182 92" stroke={GREEN_SOFT} strokeWidth={10} fill="none" />
          <path d="M 138 92 A 22 22 0 0 1 172 74" stroke={GREEN} strokeWidth={10} fill="none" />
          <rect x={140} y={112} width={8} height={28} fill={GREEN} />
          <rect x={152} y={104} width={8} height={36} fill={GREEN_DARK} />
          <rect x={164} y={120} width={8} height={20} fill={YELLOW} />
          <rect x={176} y={96} width={8} height={44} fill={NAVY} />
          {signal(262, 66, GREEN_DARK)}
        </g>
      );
    case "compare":
      return (
        <g>
          <rect width={320} height={180} fill={GREEN_SOFT} />
          <rect x={28} y={46} width={76} height={92} rx={10} fill={WHITE} stroke={NAVY} strokeWidth={3} />
          <rect x={48} y={72} width={36} height={40} rx={5} fill={YELLOW} stroke={NAVY} strokeWidth={2} />
          <path d="M 48 92 H 84 M 66 72 V 112" stroke={NAVY} strokeWidth={2} />
          <rect x={122} y={46} width={76} height={92} rx={10} fill={GREEN} />
          <rect x={142} y={70} width={36} height={44} rx={4} fill={WHITE} />
          <rect x={150} y={80} width={20} height={24} rx={3} fill={GREEN_DARK} />
          <rect x={216} y={46} width={76} height={92} rx={10} fill={NAVY} />
          <circle cx={254} cy={104} r={4} fill={YELLOW} />
          <path d="M 242 92 A 17 17 0 0 1 266 92" stroke={YELLOW} strokeWidth={3} fill="none" />
          <path d="M 234 84 A 28 28 0 0 1 274 84" stroke={YELLOW} strokeWidth={3} fill="none" opacity={0.7} />
        </g>
      );
    case "install":
      return (
        <g>
          <rect width={320} height={180} fill={GREEN} />
          {dots(WHITE)}
          <rect x={92} y={18} width={84} height={150} rx={14} fill={NAVY} />
          <rect x={100} y={30} width={68} height={126} rx={6} fill={WHITE} />
          {[
            [110, 50], [128, 50], [146, 50], [110, 68], [146, 68], [110, 86], [128, 86], [146, 86], [128, 68],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={i === 8 ? 8 : 14} height={i === 8 ? 8 : 14} fill={i % 3 === 0 ? NAVY : GREEN_DARK} />
          ))}
          <rect x={110} y={112} width={48} height={8} rx={4} fill={GREEN_SOFT} />
          <rect x={110} y={126} width={32} height={8} rx={4} fill={GREEN_SOFT} />
          <circle cx={226} cy={92} r={30} fill={YELLOW} />
          <path d="M 212 92 L 222 102 L 242 82" stroke={NAVY} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "whatsapp":
    default:
      return (
        <g>
          <rect width={320} height={180} fill={NAVY} />
          <rect x={196} y={22} width={78} height={140} rx={14} fill={WHITE} />
          <rect x={206} y={40} width={58} height={14} rx={7} fill={GREEN} />
          <rect x={206} y={62} width={58} height={14} rx={7} fill={YELLOW} />
          <path d="M 40 52 H 150 A 12 12 0 0 1 162 64 V 92 A 12 12 0 0 1 150 104 H 70 L 52 118 L 56 104 H 40 A 12 12 0 0 1 28 92 V 64 A 12 12 0 0 1 40 52 Z" fill={GREEN} />
          <path d="M 70 116 H 166 A 10 10 0 0 1 176 126 V 146 A 10 10 0 0 1 166 156 H 158 L 162 166 L 146 156 H 70 A 10 10 0 0 1 60 146 V 126 A 10 10 0 0 1 70 116 Z" fill={WHITE} opacity={0.92} />
          <path d="M 48 72 H 140 M 48 86 H 112" stroke={WHITE} strokeWidth={5} strokeLinecap="round" />
          <path d="M 76 132 H 160 M 76 142 H 128" stroke={NAVY} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
  }
}

export function ArticleArt({
  theme,
  alt,
  className,
  width,
  height,
  decorative = false,
}: {
  theme: ArtTheme;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 320 180"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": alt })}
    >
      {scene(theme)}
    </svg>
  );
}
