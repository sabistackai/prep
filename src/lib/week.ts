// Shape of weekly_summary() (see supabase/migrations/20261110000000_daily_care.sql).

export type PrepResult = "on_time" | "late" | "missed" | "pending" | null;

export type WeekSummary = {
  start: string;
  end: string;
  prep: {
    on_time: number;
    late: number;
    missed: number;
    pending: number;
    nights: { date: string; result: PrepResult; completed_at: string | null; deadline_at: string | null }[];
  };
  care: {
    on_time: number;
    late: number;
    missed: number;
    skipped: number;
    upcoming: number;
    days: { date: string; on_time: number; late: number; missed: number; upcoming: number }[];
    children: { id: string; name: string; color: string; on_time: number; late: number; missed: number }[];
    trouble: { child: string; title: string; late: number; missed: number }[];
  };
  tasks: { on_time: number; late: number; open_overdue: number; done_no_due: number };
};

export function careCounted(c: { on_time: number; late: number; missed: number }) {
  return c.on_time + c.late + c.missed;
}

// "62%" of counted items on time, or null when nothing was due yet.
export function onTimeShare(c: { on_time: number; late: number; missed: number }) {
  const n = careCounted(c);
  return n ? Math.round((c.on_time / n) * 100) : null;
}
