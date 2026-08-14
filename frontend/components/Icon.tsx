/**
 * Line icons, drawn as inline SVG.
 *
 * They are here rather than pulled from a package so the whole set is
 * visible in one file and every icon inherits the surrounding text colour.
 */

const PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
      <rect x="11.5" y="2.5" width="6" height="4" rx="1" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" />
      <rect x="11.5" y="9.5" width="6" height="8" rx="1" />
    </>
  ),
  zones: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M2.5 10h15M10 2.5c2 2.4 3 4.9 3 7.5s-1 5.1-3 7.5c-2-2.4-3-4.9-3-7.5s1-5.1 3-7.5z" />
    </>
  ),
  traffic: (
    <>
      <path d="M2.5 5.5h4l7 9h4M2.5 14.5h4l2-2.6M12 7.1l1.5-1.6h4" />
      <path d="M15.5 3.5l2 2-2 2M15.5 12.5l2 2-2 2" />
    </>
  ),
  health: <path d="M2.5 10.5h3.2l1.8-4.5 2.8 8.5 2-4h5.2" />,
  resolver: (
    <>
      <rect x="2.5" y="3" width="15" height="6" rx="1.5" />
      <rect x="2.5" y="11" width="15" height="6" rx="1.5" />
      <path d="M5.5 6h.01M5.5 14h.01" />
    </>
  ),
  profiles: (
    <>
      <path d="M10 2.5l7.5 3.8L10 10 2.5 6.3 10 2.5z" />
      <path d="M2.5 10L10 13.8 17.5 10M2.5 13.7l7.5 3.8 7.5-3.8" />
    </>
  ),
  refresh: (
    <>
      <path d="M16.5 5.5v4h-4" />
      <path d="M16.2 9.4a6.5 6.5 0 10-1.3 4.6" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v2M10 16.5v2M3.9 3.9l1.4 1.4M14.7 14.7l1.4 1.4M1.5 10h2M16.5 10h2M3.9 16.1l1.4-1.4M14.7 5.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M16.5 11.8A7 7 0 018.2 3.5a7 7 0 108.3 8.3z" />,
  upload: (
    <>
      <path d="M3 13v3.5h14V13" />
      <path d="M10 13V3.5M6.5 7L10 3.5 13.5 7" />
    </>
  ),
  download: (
    <>
      <path d="M3 13v3.5h14V13" />
      <path d="M10 3.5V13M6.5 9.5L10 13l3.5-3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 5h13M8 5V3.5h4V5M5 5l.8 11.5h8.4L15 5" />
      <path d="M8.5 8v6M11.5 8v6" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1.5" y="5" width="17" height="10" rx="2" />
      <path d="M5 8h.01M8 8h.01M11 8h.01M14 8h.01M5 11.5h.01M14 11.5h.01M8 11.5h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.5V10l3 2" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      {PATHS[name] ?? PATHS.clock}
    </svg>
  );
}
