"use client";

import { useState } from "react";
import { formatDay } from "@/lib/format";
import type { WeekSummary } from "@/lib/week";

// Daily care per day as stacked columns: on time (bottom), late, not ticked.
// Colours are the validated --chart-* tokens; identity also comes from the legend,
// the tooltip and the table view, never colour alone.
const SERIES = [
  { key: "on_time", label: "On time", className: "bg-chart-on-time" },
  { key: "late", label: "Late", className: "bg-chart-late" },
  { key: "missed", label: "Not ticked", className: "bg-chart-missed" },
] as const;

const PLOT_PX = 120;

export function CareLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-2.5 rounded-sm ${s.className}`} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function WeekChart({ days, today }: { days: WeekSummary["care"]["days"]; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = days.map((d) => d.on_time + d.late + d.missed);
  const max = Math.max(1, ...totals);
  const shown = hover !== null ? days[hover] : null;

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CareLegend />
        <p aria-live="polite" className="min-h-5 text-xs font-semibold text-text">
          {shown
            ? `${formatDay(shown.date)}: ${shown.on_time} on time, ${shown.late} late, ${shown.missed} not ticked${
                shown.upcoming ? `, ${shown.upcoming} still to come` : ""
              }`
            : ""}
        </p>
      </div>

      <div className="relative">
        {/* One recessive hairline at the top value, plus the baseline. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2" aria-hidden>
          <span className="w-5 text-right text-[11px] tabular-nums text-muted">{max}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="flex items-end gap-1 pl-7" style={{ height: PLOT_PX }}>
          {days.map((d, i) => {
            const total = totals[i];
            const parts = SERIES.map((s) => ({ ...s, value: d[s.key] })).filter((p) => p.value > 0);
            return (
              <button
                key={d.date}
                type="button"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
                aria-label={`${formatDay(d.date)}: ${d.on_time} on time, ${d.late} late, ${d.missed} not ticked`}
                className={`flex h-full flex-1 flex-col items-center justify-end rounded-md ${hover === i ? "bg-surface-2" : ""}`}
              >
                {total > 0 ? (
                  <span
                    className="flex w-full max-w-6 flex-col-reverse gap-[2px]"
                    style={{ height: `${(total / max) * 100}%` }}
                  >
                    {parts.map((p, j) => (
                      <span
                        key={p.key}
                        className={`${p.className} ${j === parts.length - 1 ? "rounded-t-[4px]" : ""}`}
                        style={{ flexGrow: p.value, flexBasis: 0, minHeight: 2 }}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="h-px w-full max-w-6 bg-border" />
                )}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-border" style={{ marginLeft: "1.75rem" }} aria-hidden />
        <div className="flex gap-1 pl-7 pt-1" aria-hidden>
          {days.map((d) => (
            <span
              key={d.date}
              className={`flex-1 text-center text-[11px] ${d.date === today ? "font-extrabold text-text" : "font-semibold text-muted"}`}
            >
              {formatDay(d.date).slice(0, 3)}
            </span>
          ))}
        </div>
      </div>

      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-primary">Show as a table</summary>
        <table className="w-full text-left tabular-nums">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 font-semibold">Day</th>
              <th className="py-1 text-right font-semibold">On time</th>
              <th className="py-1 text-right font-semibold">Late</th>
              <th className="py-1 text-right font-semibold">Not ticked</th>
              <th className="py-1 text-right font-semibold">To come</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {days.map((d) => (
              <tr key={d.date}>
                <td className="py-1.5">{formatDay(d.date)}</td>
                <td className="py-1.5 text-right">{d.on_time}</td>
                <td className="py-1.5 text-right">{d.late}</td>
                <td className="py-1.5 text-right">{d.missed}</td>
                <td className="py-1.5 text-right">{d.upcoming}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
