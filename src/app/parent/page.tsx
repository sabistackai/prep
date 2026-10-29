import Link from "next/link";
import { rebuildTonight } from "@/app/parent/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { LiveRefresh } from "@/components/live-refresh";
import { PrepBoard } from "@/components/prep-board";
import { TaskCard } from "@/components/task-card";
import { Card, Mono, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { dayName, loadPrep } from "@/lib/prep";
import { loadTasks } from "@/lib/tasks";

export default async function TodayPage() {
  const { supabase } = await requireParent();
  const [{ overview, kids, items }, { data: household }, { data: nannies }, { count: activities }, tasks] = await Promise.all([
    loadPrep(supabase),
    supabase.from("households").select("name").single(),
    supabase.from("members").select("user_id").eq("role", "nanny"),
    supabase.from("activities").select("*", { count: "exact", head: true }),
    loadTasks(supabase, 0),
  ]);
  const session = overview?.session;

  const steps = [
    { done: kids.length > 0, label: "Add the children", href: "/parent/settings#children" },
    { done: true, label: "Check each child's week of outfits", href: "/parent/routine" },
    { done: (activities ?? 0) > 0, label: "Add weekend activities", href: "/parent/activities" },
    { done: (nannies ?? []).length > 0, label: "Add the nanny and send the setup link", href: "/parent/settings#nannies" },
    { done: (nannies ?? []).some((n) => n.user_id), label: "Nanny finishes setup on their phone", href: "/parent/settings#nannies" },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <>
      <LiveRefresh tables={["tasks"]} />
      <PageHeader title={household?.name ?? "Today"} />

      {session ? (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-xl font-semibold">Prep for {dayName(session.for_date)}</h2>
          <PrepBoard session={session} items={items} kids={kids} canTick={false} />
          <details className="mt-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-muted hover:text-text">
              Changed the routine since the list went out?
            </summary>
            <ActionForm action={rebuildTonight} className="space-y-2 pb-2">
              <input type="hidden" name="id" value={session.id} />
              <p className="text-muted">Rebuild tonight&apos;s list from the current routine. Items already ticked stay ticked.</p>
              <SubmitButton variant="secondary">Rebuild tonight&apos;s list</SubmitButton>
            </ActionForm>
          </details>
        </section>
      ) : (
        <Card className="mb-4">
          <h2 className="font-display text-lg font-semibold">Tonight&apos;s prep</h2>
          <p className="mt-1 text-sm text-muted">
            The nanny gets {overview?.tomorrow ?? "tomorrow"}&apos;s checklist at <Mono>{overview?.release_time}</Mono>,
            due by <Mono>{overview?.deadline_time}</Mono>. You&apos;ll see their progress here live.
          </p>
        </Card>
      )}

      {tasks.open.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Open tasks</h2>
            <Link href="/parent/tasks" className="text-sm font-semibold text-primary hover:underline">
              All tasks
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.open.slice(0, 3).map((t) => (
              <TaskCard key={t.id} task={t} meta={`For ${tasks.name(t.assigned_to)}`} />
            ))}
          </div>
          {tasks.open.length > 3 && (
            <p className="mt-2 text-sm text-muted">and {tasks.open.length - 3} more</p>
          )}
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
