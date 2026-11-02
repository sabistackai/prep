import type { ReactNode } from "react";
import { CareLegend, WeekChart } from "@/components/week-chart";
import { labelClass } from "@/components/ui";
import { formatClock, formatDay } from "@/lib/format";
import { careCounted, onTimeShare, type PrepResult, type WeekSummary } from "@/lib/week";

// A headline number: label, value, and a short line under it.
export function StatTile({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "danger" }) {
  return (
    <div className="rounded-[16px] border border-border bg-surface p-3 shadow-sm shadow-text/5 dark:shadow-none">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

const PREP_CELL: Record<Exclude<PrepResult, null>, { icon: string; label: string; className: string }> = {
  on_time: { icon: "✓", label: "On time", className: "bg-success-soft text-success" },
  late: { icon: "!", label: "Late", className: "bg-accent-soft text-accent-text" },
  missed: { icon: "✕", label: "Missed", className: "bg-danger-soft text-danger" },
  pending: { icon: "◷", label: "Tonight", className: "bg-surface-2 text-text" },
};

// One cell per night: symbol and word as well as colour.
function PrepNights({ nights }: { nights: WeekSummary["prep"]["nights"] }) {
  return (
    <ol className="grid grid-cols-7 gap-1">
      {nights.map((n) => {
        const cell = n.result ? PREP_CELL[n.result] : null;
        const finished = n.completed_at ? ` at ${formatClock(n.completed_at)}` : "";
        return (
          <li
            key={n.date}
            title={cell ? `Prep for ${formatDay(n.date)}: ${cell.label}${finished}` : `No list for ${formatDay(n.date)}`}
            className={`flex min-h-14 flex-col items-center justify-center rounded-[10px] text-center ${
              cell ? cell.className : "border border-border text-muted"
            }`}
          >
            <span className="text-[11px] font-semibold">{formatDay(n.date).slice(0, 3)}</span>
            <span aria-hidden className="text-base font-extrabold">{cell?.icon ?? "–"}</span>
            <span className="sr-only">{cell ? `${cell.label}${finished}` : "No list"}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Thin segmented bar: each child's split, with the figures written beside it.
function ChildSplit({ child }: { child: WeekSummary["care"]["children"][number] }) {
  const total = careCounted(child);
  const parts = [
    { value: child.on_time, className: "bg-chart-on-time" },
    { value: child.late, className: "bg-chart-late" },
    { value: child.missed, className: "bg-chart-missed" },
  ].filter((p) => p.value > 0);
  return (
    <li className="space-y-1.5 py-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: child.color }} />
          {child.name}
        </span>
        <span className="text-muted">
          {child.on_time} on time · {child.late} late · {child.missed} not ticked
        </span>
      </p>
      {total > 0 && (
        <div aria-hidden className="flex h-2 gap-[2px] overflow-hidden rounded-full">
          {parts.map((p, i) => (
            <span key={i} className={p.className} style={{ flexGrow: p.value, flexBasis: 0 }} />
          ))}
        </div>
      )}
    </li>
  );
}

export function WeekTiles({ summary }: { summary: WeekSummary }) {
  const { prep, care, tasks } = summary;
  const nights = prep.on_time + prep.late + prep.missed;
  const share = onTimeShare(care);
  const tasksDone = tasks.on_time + tasks.late + tasks.done_no_due;
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile
        label="Prep on time"
        value={nights ? `${prep.on_time} of ${nights}` : "–"}
        note={nights ? `${nights === 1 ? "night" : "nights"}${prep.missed ? ` · ${prep.missed} missed` : ""}` : "No lists yet"}
        tone={prep.missed ? "danger" : undefined}
      />
      <StatTile
        label="Daily care on time"
        value={share === null ? "–" : `${share}%`}
        note={share === null ? "Nothing due yet" : `${care.on_time} of ${careCounted(care)} items`}
      />
      <StatTile
        label="Tasks done"
        value={tasksDone}
        note={
          tasks.late || tasks.open_overdue
            ? [tasks.late && `${tasks.late} late`, tasks.open_overdue && `${tasks.open_overdue} overdue`].filter(Boolean).join(" · ")
            : "None late"
        }
        tone={tasks.open_overdue ? "danger" : undefined}
      />
    </div>
  );
}

// The full week: tiles, the daily-care chart, prep nights, each child, and what went wrong most.
export function WeekSummaryView({ summary, today }: { summary: WeekSummary; today: string }) {
  const { care } = summary;
  return (
    <div className="space-y-4">
      <WeekTiles summary={summary} />

      <section className="rounded-[16px] border border-border bg-surface p-4 shadow-sm shadow-text/5 dark:shadow-none">
        <h3 className="mb-3 font-display text-lg font-semibold">Daily care, day by day</h3>
        {careCounted(care) + care.upcoming === 0 ? (
          <p className="text-sm text-muted">Nothing was on the schedule this week.</p>
        ) : (
          <WeekChart days={care.days} today={today} />
        )}
      </section>

      <section className="rounded-[16px] border border-border bg-surface p-4 shadow-sm shadow-text/5 dark:shadow-none">
        <h3 className="mb-3 font-display text-lg font-semibold">Evening prep</h3>
        <PrepNights nights={summary.prep.nights} />
        <p className="mt-2 text-xs text-muted">Each day shows the list prepared the night before. ✓ on time · ! finished late · ✕ not finished</p>
      </section>

      {care.children.length > 0 && (
        <section className="rounded-[16px] border border-border bg-surface p-4 shadow-sm shadow-text/5 dark:shadow-none">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold">Each child</h3>
            <CareLegend />
          </div>
          <ul className="divide-y divide-border">
            {care.children.map((c) => (
              <ChildSplit key={c.id} child={c} />
            ))}
          </ul>
        </section>
      )}

      {care.trouble.length > 0 && (
        <section className="rounded-[16px] border border-border bg-surface p-4 shadow-sm shadow-text/5 dark:shadow-none">
          <h3 className={`mb-2 ${labelClass}`}>Most often late or not ticked</h3>
          <ul className="space-y-1 text-sm">
            {care.trouble.map((t) => (
              <li key={`${t.child}-${t.title}`} className="flex justify-between gap-3">
                <span className="font-semibold">
                  {t.child}: {t.title}
                </span>
                <span className="text-muted">
                  {[t.late && `${t.late} late`, t.missed && `${t.missed} not ticked`].filter(Boolean).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {care.skipped > 0 && (
        <p className="text-xs text-muted">
          {care.skipped} {care.skipped === 1 ? "item was" : "items were"} skipped and aren&apos;t counted.
        </p>
      )}
    </div>
  );
}
