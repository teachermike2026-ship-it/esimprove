/**
 * Admin console icons: inline SVG in the Lucide style (24px grid, 2px round
 * strokes, currentColor). Inline so the console needs no icon dependency.
 */
import type { SVGProps } from "react";

export type AdminIconName =
  | "home"
  | "cart"
  | "alert"
  | "card"
  | "scale"
  | "server"
  | "chart"
  | "users"
  | "lifebuoy"
  | "activity"
  | "funnel"
  | "layers"
  | "tag"
  | "mail"
  | "bell"
  | "file"
  | "settings"
  | "search"
  | "help"
  | "menu"
  | "close"
  | "refresh"
  | "dollar"
  | "trending"
  | "percent"
  | "calendar"
  | "chevron"
  | "external"
  | "logout"
  | "send"
  | "check"
  | "clock"
  | "more";

const PATHS: Record<AdminIconName, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M9.5 21v-6h5v6"],
  cart: ["M3 3h2l2.4 11.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 7H6", "M9 20.5h.01", "M18 20.5h.01"],
  alert: ["M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z", "M12 9v4", "M12 17h.01"],
  card: ["M2.5 6.5A2 2 0 0 1 4.5 4.5h15a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2Z", "M2.5 10h19", "M6.5 15h3"],
  scale: ["M12 3v18", "M7 21h10", "M5 7h14", "M5 7 2.5 13a3 3 0 0 0 5 0Z", "M19 7l-2.5 6a3 3 0 0 0 5 0Z"],
  server: ["M3.5 4.5h17v6h-17Z", "M3.5 13.5h17v6h-17Z", "M7 7.5h.01", "M7 16.5h.01"],
  chart: ["M3 3v18h18", "M8 16v-5", "M13 16V7", "M18 16v-8"],
  users: ["M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20", "M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M21 20v-1.5a4 4 0 0 0-3-3.9", "M16 3.6a3.5 3.5 0 0 1 0 6.8"],
  lifebuoy: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "m5.6 5.6 3.6 3.6", "m14.8 14.8 3.6 3.6", "m14.8 9.2 3.6-3.6", "m5.6 18.4 3.6-3.6"],
  activity: ["M3 12h4l3-8 4 16 3-8h4"],
  funnel: ["M3 4h18l-7 8.5V19l-4 2v-8.5Z"],
  layers: ["m12 3 9 5-9 5-9-5Z", "m3 13 9 5 9-5", "m3 17.5 9 5 9-5"],
  tag: ["M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z", "M7.5 7.5h.01"],
  mail: ["M3 5.5h18v13H3Z", "m3 6 9 7 9-7"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.9 1.9 0 0 0 3.4 0"],
  file: ["M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z", "M14 3v6h6", "M8 13h8", "M8 17h5"],
  settings: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  ],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  close: ["M18 6 6 18", "M6 6l12 12"],
  refresh: ["M21 12a9 9 0 0 1-15.5 6.3L3 16", "M3 12a9 9 0 0 1 15.5-6.3L21 8", "M21 3v5h-5", "M3 21v-5h5"],
  dollar: ["M12 2v20", "M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  trending: ["m22 7-8.5 8.5-5-5L2 17", "M16 7h6v6"],
  percent: ["M19 5 5 19", "M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  calendar: ["M4 5.5h16v15H4Z", "M16 3v4", "M8 3v4", "M4 10h16"],
  chevron: ["m6 9 6 6 6-6"],
  external: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  check: ["M20 6 9 17l-5-5"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
};

export function AdminIcon({ name, size = 18, ...props }: { name: AdminIconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
