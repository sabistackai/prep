// The PREP mark: a letter P whose bowl is a ticked box and whose stem carries list lines.
// Colours come from CSS tokens, so the light/dark variant follows the theme with no flash;
// wrap it in `.on-indigo` to force the dark-background variant on an indigo panel.
// Smaller than 48 px drops the list lines; 28 px and below keeps only stem and bowl (spec 6.3).
export function PrepMark({ size = 40, title }: { size?: number; title?: string }) {
  const lines = size > 48;
  const tick = size > 28;
  return (
    <svg
      viewBox="18 8 90 104"
      width={(size * 90) / 104}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="shrink-0"
    >
      <rect x="40" y="16" width="60" height="50" rx="18" style={{ fill: "var(--accent)" }} />
      <rect x="28" y="16" width="18" height="88" rx="9" style={{ fill: "var(--mark-stem)" }} />
      {tick && (
        <path
          d="M63 41l9 9 16-17"
          fill="none"
          style={{ stroke: "var(--brand-indigo)" }}
          strokeWidth={lines ? 8 : 10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {lines && (
        <g style={{ fill: "var(--mark-lines)", opacity: "var(--mark-lines-opacity)" }}>
          <rect x="54" y="78" width="30" height="9" rx="4.5" />
          <rect x="54" y="95" width="18" height="9" rx="4.5" />
        </g>
      )}
    </svg>
  );
}
