import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { NannyTask } from "@/components/nanny-task";
import { PrepBoard } from "@/components/prep-board";
import { Card, labelClass, Mono, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { careState, sortCare } from "@/lib/care";
import { loadCareToday } from "@/lib/care-data";
import { formatClock } from "@/lib/format";
import { dayName, loadPrep } from "@/lib/prep";
import { loadTasks } from "@/lib/tasks";

// Home: tonight's prep, then open tasks, so nothing depends only on a push arriving.
export default async function NannyPrepPage() {
  const { supabase } = await requireNanny();
  const [{ overview, kids, items }, tasks, care] = await Promise.all([
    loadPrep(supabase),
    loadTasks(supabase, 0),
    loadCareToday(supabase),
  ]);
  const session = overview?.session;
  // The next open items on today's schedule (late ones first, as they're earliest).
  const now = Date.now();
  const open = sortCare(care.rows, care.kids.map((k) => k.id)).filter((r) =>
    ["late", "soon", "upcoming"].includes(careState(r, now)),
  );
  const nextDue = open[0]?.due_at;
  const next = open.filter((r) => r.due_at === nextDue);
  const late = open.filter((r) => careState(r, now) === "late").length;

  return (
    <>
      <LiveRefresh tables={["tasks"]} />
      {next.length > 0 && (
        <Link
          href="/nanny/today"
          className={`mb-5 block rounded-[16px] border px-4 py-3 ${late ? "border-danger bg-danger-soft text-danger" : "border-border bg-surface"}`}
        >
          <span
            className={`block text-xs font-extrabold uppercase tracking-[0.12em] ${late ? "text-danger" : "text-muted"}`}
          >
            {late ? `! ${late} late on today's schedule` : `Next today · ${formatClock(nextDue!)}`}
          </span>
          <span className="mt-1 block font-semibold">
            {next.map((r) => `${care.kids.find((k) => k.id === r.child_id)?.name}: ${r.title}`).join(" · ")}
          </span>
          <span className="mt-1 block text-sm font-bold text-primary">Open today&apos;s schedule ›</span>
        </Link>
      )}

      <PageHeader title={session ? `Prep for ${dayName(session.for_date)}` : "Tonight's prep"} />

      {session ? (
        <PrepBoard session={session} items={items} kids={kids} canTick />
      ) : (
        <Card>
          <p>
            {overview?.tomorrow ? `${overview.tomorrow}'s` : "Tomorrow's"} checklist arrives at{" "}
            <Mono>{overview?.release_time}</Mono>. It&apos;s due by <Mono>{overview?.deadline_time}</Mono>.
          </p>
          <p className="mt-3 text-sm text-muted">
            Make sure{" "}
            <Link href="/nanny/notifications" className="font-semibold text-primary hover:underline">
              notifications are on
            </Link>{" "}
            so you don&apos;t miss it.
          </p>
        </Card>
      )}

      {tasks.open.length > 0 && (
        <section className="mt-6">
          <h2 className={`mb-2 ${labelClass}`}>Tasks</h2>
          <div className="space-y-2">
            {tasks.open.map((t) => (
              <NannyTask key={t.id} task={t} from={tasks.name(t.created_by)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
