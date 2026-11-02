import Link from "next/link";
import { rebuildTonight, skipCare } from "@/app/parent/actions";
import { CareBoard } from "@/components/care-board";
import { ActionForm, SubmitButton } from "@/components/form";
import { LiveRefresh } from "@/components/live-refresh";
import { loadNotificationHealth, NotificationWarning } from "@/components/notification-warning";
import { PrepBoard } from "@/components/prep-board";
import { TaskCard } from "@/components/task-card";
import { Card, Mono, PageHeader } from "@/components/ui";
import { WeekChart } from "@/components/week-chart";
import { StatTile, WeekTiles } from "@/components/week-summary";
import { requireParent } from "@/lib/auth";
import { careTotals } from "@/lib/care";
import { loadCareToday } from "@/lib/care-data";
import { formatDay } from "@/lib/format";
import { dayName, loadPrep } from "@/lib/prep";
import { loadTasks } from "@/lib/tasks";
import type { WeekSummary } from "@/lib/week";

function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-primary hover:underline">
          {link}
        </Link>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const { supabase } = await requireParent();
  const [
    { overview, kids, items },
    { data: household },
    { data: nannies },
    { count: scheduled },
    { count: cards },
    tasks,
    health,
    care,
    { data: week },
  ] = await Promise.all([
    loadPrep(supabase),
    supabase.from("households").select("name, care_lead_minutes").single(),
    supabase.from("members").select("user_id").eq("role", "nanny"),
    supabase.from("care_items").select("*", { count: "exact", head: true }),
    supabase.from("care_cards").select("*", { count: "exact", head: true }),
    loadTasks(supabase, 0),
    loadNotificationHealth(supabase),
    loadCareToday(supabase),
    supabase.rpc("weekly_summary"),
  ]);
  const session = overview?.session;
  const summary = week as WeekSummary | null;
  const now = Date.now();
  const today = careTotals(care.rows, now);
  const overdueTasks = tasks.open.filter((t) => t.due_at && new Date(t.due_at).getTime() < now).length;
  const prepItems = items.length;
  const prepDone = items.filter((i) => i.checked_at).length;

  const steps = [
    { done: kids.length > 0, label: "Add the children", href: "/parent/settings#children" },
    { done: (scheduled ?? 0) > 0, label: "Set up each child's daily schedule", href: "/parent/schedule" },
    { done: (cards ?? 0) > 0, label: "Fill in the care cards (allergies, medicines)", href: "/parent/care" },
    { done: true, label: "Check each child's week of outfits", href: "/parent/routine" },
    { done: (nannies ?? []).length > 0, label: "Add the nanny and send the setup link", href: "/parent/settings#nannies" },
    { done: (nannies ?? []).some((n) => n.user_id), label: "Nanny finishes setup on their phone", href: "/parent/settings#nannies" },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <>
      <LiveRefresh tables={["tasks"]} />
      <PageHeader title={household?.name ?? "Dashboard"} subtitle={formatDay(care.date)} />
      {health.length > 0 && (
        <div className="mb-6 space-y-2">
          {health.map((h) => (
            <NotificationWarning key={h.member_id} health={h} />
          ))}
        </div>
      )}

      {/* Today at a glance */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        <StatTile
          label="Daily care"
          value={today.total ? `${today.done} of ${today.total}` : "–"}
          note={today.late ? `! ${today.late} late` : today.total ? "done so far" : "Nothing scheduled"}
          tone={today.late ? "danger" : undefined}
        />
        <StatTile
          label="Tonight's prep"
          value={session ? `${prepDone} of ${prepItems}` : "–"}
          note={
            session
              ? session.status === "complete"
                ? "✓ Everyone ready"
                : session.status === "overdue"
                  ? "! Past the deadline"
                  : "items ticked"
              : `List goes out ${overview?.release_time ?? ""}`
          }
          tone={session?.status === "overdue" ? "danger" : undefined}
        />
        <StatTile
          label="Open tasks"
          value={tasks.open.length}
          note={overdueTasks ? `! ${overdueTasks} overdue` : "None overdue"}
          tone={overdueTasks ? "danger" : undefined}
        />
      </div>

      <section className="mb-6">
        <SectionHead title="Today's schedule" href="/parent/schedule" link="Edit schedule" />
        <CareBoard
          date={care.date}
          rows={care.rows}
          kids={care.kids}
          canTick={false}
          leadMinutes={household?.care_lead_minutes ?? 30}
          skipAction={skipCare}
          emptyText="Nothing on today's schedule. Add meals, baths, medicine and bedtimes under Schedule."
        />
      </section>

      {session ? (
        <section className="mb-6">
          <SectionHead title={`Prep for ${dayName(session.for_date)}`} />
          <PrepBoard session={session} items={items} kids={kids} canTick={false} />
          <details className="mt-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-muted hover:text-text">
              Changed the outfits since the list went out?
            </summary>
            <ActionForm action={rebuildTonight} className="space-y-2 pb-2">
              <input type="hidden" name="id" value={session.id} />
              <p className="text-muted">Rebuild tonight&apos;s list from the current routine. Items already ticked stay ticked.</p>
              <SubmitButton variant="secondary">Rebuild tonight&apos;s list</SubmitButton>
            </ActionForm>
          </details>
        </section>
      ) : (
        <Card className="mb-6">
          <h2 className="font-display text-lg font-semibold">Tonight&apos;s prep</h2>
          <p className="mt-1 text-sm text-muted">
            The nanny gets {overview?.tomorrow ?? "tomorrow"}&apos;s checklist at <Mono>{overview?.release_time}</Mono>,
            due by <Mono>{overview?.deadline_time}</Mono>. You&apos;ll see their progress here live.
          </p>
        </Card>
      )}

      {tasks.open.length > 0 && (
        <section className="mb-6">
          <SectionHead title="Open tasks" href="/parent/tasks" link="All tasks" />
          <div className="space-y-2">
            {tasks.open.slice(0, 3).map((t) => (
              <TaskCard key={t.id} task={t} meta={`For ${tasks.name(t.assigned_to)}`} />
            ))}
          </div>
          {tasks.open.length > 3 && <p className="mt-2 text-sm text-muted">and {tasks.open.length - 3} more</p>}
        </section>
      )}

      {summary && (
        <section className="mb-6">
          <SectionHead title="This week" href="/parent/week" link="Full summary" />
          <div className="space-y-3">
            <WeekTiles summary={summary} />
            {summary.care.days.some((d) => d.on_time + d.late + d.missed > 0) && (
              <Card>
                <h3 className="mb-3 text-sm font-bold">Daily care, day by day</h3>
                <WeekChart days={summary.care.days} today={care.date} />
              </Card>
            )}
          </div>
        </section>
      )}

      {remaining > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold">Getting started</h2>
          <ul className="mt-3 space-y-1">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex min-h-11 items-center gap-3 text-sm">
                  <span
                    className={`grid size-5 place-items-center rounded-full border text-xs ${
                      s.done ? "border-success bg-success-soft text-success" : "border-border"
                    }`}
                  >
                    {s.done ? "✓" : ""}
                  </span>
                  <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
