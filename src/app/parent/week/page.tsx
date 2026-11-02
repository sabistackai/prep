import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { WeekSummaryView } from "@/components/week-summary";
import { requireParent } from "@/lib/auth";
import { addDays, formatDay, lagosDate, weekStart } from "@/lib/format";
import type { WeekSummary } from "@/lib/week";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { supabase } = await requireParent();
  const { day } = await searchParams;
  const today = lagosDate();
  const start = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(day ?? "") ? day! : today);
  const thisWeek = weekStart(today);

  const { data } = await supabase.rpc("weekly_summary", { p_day: start });
  const summary = data as WeekSummary | null;

  const link = "flex min-h-11 items-center rounded-[10px] border border-border bg-surface px-4 text-sm font-bold hover:border-primary";
  return (
    <>
      <PageHeader
        title={start === thisWeek ? "This week" : `Week of ${formatDay(start).slice(4)}`}
        subtitle={`${formatDay(start)} to ${formatDay(addDays(start, 6))}`}
      />
      <nav className="mb-4 flex justify-between gap-2" aria-label="Weeks">
        <Link href={`/parent/week?day=${addDays(start, -7)}`} className={link}>
          ‹ Week before
        </Link>
        {start < thisWeek && (
          <Link href={`/parent/week?day=${addDays(start, 7)}`} className={link}>
            Week after ›
          </Link>
        )}
      </nav>
      {summary ? (
        <WeekSummaryView summary={summary} today={today} />
      ) : (
        <p className="text-sm text-muted">Couldn&apos;t load the summary. Please try again.</p>
      )}
    </>
  );
}
