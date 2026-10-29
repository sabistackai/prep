import type { ReactNode } from "react";

export const inputClass =
  "w-full min-h-11 rounded-[10px] border border-border bg-surface-2 px-3 text-text placeholder:text-muted focus:border-primary focus:outline-none";

// Uppercase section label (spec 4): 12px, weight 800, 0.12em tracking, muted.
export const labelClass = "text-xs font-extrabold uppercase tracking-[0.12em] text-muted";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold text-text">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[16px] border border-border bg-surface p-4 shadow-sm shadow-text/5 dark:shadow-none ${className}`}>
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-bold tabular-nums">{children}</span>;
}
