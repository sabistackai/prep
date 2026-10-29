import { PrepMark } from "./prep-mark";

// Mark + lowercase "prep" wordmark in Fredoka 600 (spec 6.4).
// Mark height ≈ 1.2 × the wordmark's cap height; gap = 0.25 × mark width.
export function PrepLogo({ size = 28, tagline = false }: { size?: number; tagline?: boolean }) {
  const markHeight = Math.round(size * 1.2);
  return (
    <span className="inline-flex items-center" style={{ gap: (markHeight * 90) / 104 / 4 }}>
      <PrepMark size={markHeight} title="PREP" />
      <span className="flex flex-col">
        <span
          className="font-display font-semibold leading-[0.9] tracking-tight"
          style={{ fontSize: size, color: "var(--wordmark)" }}
          aria-hidden
        >
          prep
        </span>
        {tagline && <span className="mt-1 text-xs font-bold text-muted">Parents&apos; Routine &amp; Errands Planner</span>}
      </span>
    </span>
  );
}
