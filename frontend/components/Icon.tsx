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
